import {
    generateToken,
    getDb,
    hashToken,
    teamInvites,
    teamMembers,
    teams,
    users,
} from "@servicebeard/db";
import {
    buildGithubAppInstallationSettingsUrl,
    getRepositoryInstallation,
    isGithubAppConfigured,
} from "@servicebeard/providers";
import {
    createTeamSchema,
    discoverMailSchema,
    inviteMemberSchema,
    parseGithubRepository,
    slugifyName,
    testMailConnectionSchema,
    testProviderConnectionSchema,
    updateMemberSchema,
    updateTeamSchema,
} from "@servicebeard/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { auditLog } from "../lib/auth";
import { testMailConnection, testProviderConnection } from "../lib/connection-test";
import { getEntitlements } from "../lib/entitlements";
import { providerFailureResponse } from "../lib/external-error";
import { startGithubAppInstall } from "../lib/github-app-install";
import { discoverMailAutoconfig } from "../lib/mail-discover";
import type { AppVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireTeamMember } from "../middleware/team";

const teamRoutes = new Hono<{ Variables: AppVariables }>();

teamRoutes.get("/", async (c) => {
  const user = requireAuth(c);
  const db = getDb();

  const memberships = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, user.id),
    with: { team: true },
  });

  const entitlements = getEntitlements();
  const teamsWithMeta = await Promise.all(
    memberships.map(async (m) => {
      const meta = entitlements.getTeamListingMeta
        ? await entitlements.getTeamListingMeta(m.team.id)
        : undefined;
      return {
        ...m.team,
        role: m.role,
        ...(meta ? { meta } : {}),
      };
    }),
  );

  return c.json({
    teams: teamsWithMeta,
  });
});

teamRoutes.post("/", async (c) => {
  const user = requireAuth(c);
  const body = createTeamSchema.parse(await c.req.json());
  const db = getDb();

  const [team] = await db
    .insert(teams)
    .values({ name: body.name, slug: body.slug })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team!.id,
    userId: user.id,
    role: "owner",
  });

  await auditLog({
    teamId: team!.id,
    userId: user.id,
    action: "create",
    resourceType: "team",
    resourceId: team!.id,
  });

  return c.json(team, 201);
});

teamRoutes.get("/:teamId", async (c) => {
  const teamId = c.req.param("teamId");
  await requireTeamMember(c, teamId);
  const db = getDb();

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      members: { with: { user: true } },
      invites: true,
    },
  });

  if (!team) return c.json({ error: "Not found" }, 404);
  return c.json(team);
});

teamRoutes.patch("/:teamId", async (c) => {
  const teamId = c.req.param("teamId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const body = updateTeamSchema.parse(await c.req.json());
  const db = getDb();

  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
  if (body.name !== undefined && body.slug === undefined) {
    updates.slug = slugifyName(body.name);
  }

  const [updated] = await db
    .update(teams)
    .set(updates)
    .where(eq(teams.id, teamId))
    .returning();

  await auditLog({
    teamId,
    userId,
    action: "update",
    resourceType: "team",
    resourceId: teamId,
  });

  return c.json(updated);
});

teamRoutes.delete("/:teamId", async (c) => {
  const teamId = c.req.param("teamId");
  const { userId } = await requireTeamMember(c, teamId, "owner");
  const db = getDb();

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  });
  if (!team) return c.json({ error: "Not found" }, 404);

  await auditLog({
    teamId,
    userId,
    action: "delete",
    resourceType: "team",
    resourceId: teamId,
    metadata: { name: team.name },
  });

  await db.delete(teams).where(eq(teams.id, teamId));

  return c.json({ ok: true });
});

teamRoutes.post("/:teamId/members", async (c) => {
  const teamId = c.req.param("teamId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const body = inviteMemberSchema.parse(await c.req.json());
  const db = getDb();

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, body.email),
  });

  if (existingUser) {
    const existingMember = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, existingUser.id),
      ),
    });
    if (existingMember) {
      return c.json({ error: "User is already a member" }, 409);
    }

    const [member] = await db
      .insert(teamMembers)
      .values({
        teamId,
        userId: existingUser.id,
        role: body.role,
      })
      .returning();

    await auditLog({
      teamId,
      userId,
      action: "add_member",
      resourceType: "team_member",
      resourceId: member!.id,
    });

    return c.json(member, 201);
  }

  const inviteToken = generateToken();
  const [invite] = await db
    .insert(teamInvites)
    .values({
      teamId,
      email: body.email,
      role: body.role,
      tokenHash: hashToken(inviteToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning();

  await auditLog({
    teamId,
    userId,
    action: "invite_member",
    resourceType: "team_invite",
    resourceId: invite!.id,
    metadata: { email: body.email },
  });

  return c.json({ invite, token: inviteToken }, 201);
});

teamRoutes.patch("/:teamId/members/:memberId", async (c) => {
  const teamId = c.req.param("teamId");
  const memberId = c.req.param("memberId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const body = updateMemberSchema.parse(await c.req.json());
  const db = getDb();

  const [updated] = await db
    .update(teamMembers)
    .set({ role: body.role })
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)))
    .returning();

  if (!updated) return c.json({ error: "Not found" }, 404);

  await auditLog({
    teamId,
    userId,
    action: "update_member",
    resourceType: "team_member",
    resourceId: memberId,
  });

  return c.json(updated);
});

teamRoutes.delete("/:teamId/members/:memberId", async (c) => {
  const teamId = c.req.param("teamId");
  const memberId = c.req.param("memberId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const db = getDb();

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)));

  await auditLog({
    teamId,
    userId,
    action: "remove_member",
    resourceType: "team_member",
    resourceId: memberId,
  });

  return c.json({ ok: true });
});

teamRoutes.post("/invites/:token/accept", async (c) => {
  const token = c.req.param("token");
  const user = requireAuth(c);
  const db = getDb();

  const invite = await db.query.teamInvites.findFirst({
    where: eq(teamInvites.tokenHash, hashToken(token)),
  });

  if (!invite || invite.expiresAt < new Date()) {
    return c.json({ error: "Invalid or expired invite" }, 400);
  }

  if (invite.email !== user.email) {
    return c.json({ error: "Invite is for a different email" }, 403);
  }

  const [member] = await db
    .insert(teamMembers)
    .values({
      teamId: invite.teamId,
      userId: user.id,
      role: invite.role,
    })
    .returning();

  await db.delete(teamInvites).where(eq(teamInvites.id, invite.id));

  return c.json(member, 201);
});

teamRoutes.post("/:teamId/test-mail", async (c) => {
  const teamId = c.req.param("teamId");
  await requireTeamMember(c, teamId, "admin");
  const body = testMailConnectionSchema.parse(await c.req.json());

  try {
    return c.json(await testMailConnection(body));
  } catch (err) {
    return c.json(providerFailureResponse("test-mail", err), 400);
  }
});

teamRoutes.post("/:teamId/discover-mail", async (c) => {
  const teamId = c.req.param("teamId");
  await requireTeamMember(c, teamId, "admin");
  const body = discoverMailSchema.parse(await c.req.json());
  return c.json(await discoverMailAutoconfig(body.email));
});

teamRoutes.post("/:teamId/test-provider", async (c) => {
  const teamId = c.req.param("teamId");
  await requireTeamMember(c, teamId, "admin");
  const body = testProviderConnectionSchema.parse(await c.req.json());

  try {
    return c.json(await testProviderConnection(body));
  } catch (err) {
    return c.json(providerFailureResponse("test-provider", err), 400);
  }
});

teamRoutes.get("/:teamId/github-app/install", async (c) => {
  const teamId = c.req.param("teamId");
  requireAuth(c);
  await requireTeamMember(c, teamId, "admin");
  return startGithubAppInstall(c, teamId);
});

teamRoutes.get("/:teamId/github-app/repository-installation", async (c) => {
  const teamId = c.req.param("teamId");
  await requireTeamMember(c, teamId, "admin");

  if (!isGithubAppConfigured()) {
    return c.json({ error: "GitHub App is not configured" }, 503);
  }

  const baseUrl = c.req.query("baseUrl")?.trim() || "https://github.com";
  const repositoryInput = c.req.query("repository")?.trim();
  if (!repositoryInput) {
    return c.json({ error: "repository is required" }, 400);
  }

  try {
    const repository = parseGithubRepository(repositoryInput);
    const installation = await getRepositoryInstallation(baseUrl, repository);
    if (!installation) {
      return c.json({ installed: false as const, repository });
    }
    return c.json({
      installed: true as const,
      repository,
      installationId: installation.installationId,
      accountLogin: installation.accountLogin,
      settingsUrl: buildGithubAppInstallationSettingsUrl(baseUrl, installation.installationId),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return c.json({ error: message }, 400);
  }
});

export { teamRoutes };
