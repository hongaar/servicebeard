import {
    encrypt,
    generateWebhookSecret,
    getDb,
    issueThreads,
    projects,
    rules,
} from "@servicebeard/db";
import { createProvider, toProviderConfig } from "@servicebeard/providers";
import {
    createProjectSchema,
    createRuleSchema,
    evaluateDraftRule,
    testMailConnectionSchema,
    testProviderConnectionSchema,
    testRuleSchema,
    updateProjectSchema,
    updateRuleSchema,
} from "@servicebeard/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { auditLog } from "../lib/auth";
import { fetchRecentMessages, parseEmail } from "../lib/mail";
import { createProjectProvider, projectMailCredentials } from "../lib/provider";
import { getBoss, QUEUE_NAMES } from "../lib/queue";
import type { AppVariables } from "../middleware/auth";
import { requireTeamMember } from "../middleware/team";

const projectRoutes = new Hono<{ Variables: AppVariables }>();

function projectWebhookUrl(projectId: string): string {
  const base = process.env.WEBHOOK_BASE_URL ?? process.env.API_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/webhooks/gitlab/${projectId}`;
}

function sanitizeProject(project: typeof projects.$inferSelect) {
  const {
    providerTokenEncrypted: _providerTokenEncrypted,
    providerCaCertEncrypted: _providerCaCertEncrypted,
    imapPasswordEncrypted: _imapPasswordEncrypted,
    smtpPasswordEncrypted: _smtpPasswordEncrypted,
    webhookSecret: _webhookSecret,
    ...safe
  } = project;
  return { ...safe, webhookUrl: projectWebhookUrl(project.id) };
}

projectRoutes.get("/:teamId/projects", async (c) => {
  const teamId = c.req.param("teamId");
  await requireTeamMember(c, teamId);
  const db = getDb();

  const list = await db.query.projects.findMany({
    where: eq(projects.teamId, teamId),
  });

  return c.json({ projects: list.map(sanitizeProject) });
});

projectRoutes.post("/:teamId/projects", async (c) => {
  const teamId = c.req.param("teamId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const body = createProjectSchema.parse(await c.req.json());
  const db = getDb();

  const webhookSecret = generateWebhookSecret();

  const [project] = await db
    .insert(projects)
    .values({
      teamId,
      name: body.name,
      slug: body.slug,
      provider: body.provider,
      providerBaseUrl: body.providerBaseUrl,
      providerProjectId: body.providerProjectId,
      providerTokenEncrypted: encrypt(body.providerToken),
      providerTlsInsecure: body.providerTlsInsecure ?? false,
      providerCaCertEncrypted: body.providerCaCert?.trim()
        ? encrypt(body.providerCaCert.trim())
        : null,
      imapHost: body.imapHost,
      imapPort: body.imapPort,
      imapSecure: body.imapSecure,
      imapUser: body.imapUser,
      imapPasswordEncrypted: encrypt(body.imapPassword),
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort,
      smtpSecure: body.smtpSecure,
      smtpUser: body.smtpUser,
      smtpPasswordEncrypted: encrypt(body.smtpPassword),
      smtpFrom: body.smtpFrom,
      webhookSecret,
      imapPollIntervalSeconds: body.imapPollIntervalSeconds,
      commentPollIntervalSeconds: body.commentPollIntervalSeconds,
    })
    .returning();

  const provider = createProvider(
    project!.provider,
    toProviderConfig({
      baseUrl: body.providerBaseUrl,
      projectId: body.providerProjectId,
      token: body.providerToken,
      tlsInsecure: body.providerTlsInsecure,
      caCert: body.providerCaCert ?? null,
    }),
  );

  const botUser = await provider.getCurrentUser();
  await db
    .update(projects)
    .set({ providerBotUserId: botUser.id })
    .where(eq(projects.id, project!.id));

  const boss = await getBoss();
  await boss.send(QUEUE_NAMES.ENSURE_WEBHOOK, { projectId: project!.id });

  await auditLog({
    teamId,
    userId,
    projectId: project!.id,
    action: "create",
    resourceType: "project",
    resourceId: project!.id,
  });

  return c.json(sanitizeProject(project!), 201);
});

projectRoutes.get("/:teamId/projects/:projectId", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  await requireTeamMember(c, teamId);
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
    with: { rules: true },
  });

  if (!project) return c.json({ error: "Not found" }, 404);
  return c.json({
    ...sanitizeProject(project),
    rules: project.rules,
  });
});

projectRoutes.patch("/:teamId/projects/:projectId", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const body = updateProjectSchema.parse(await c.req.json());
  const db = getDb();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name) updates.name = body.name;
  if (body.slug) updates.slug = body.slug;
  if (body.provider) updates.provider = body.provider;
  if (body.providerBaseUrl) updates.providerBaseUrl = body.providerBaseUrl;
  if (body.providerProjectId) updates.providerProjectId = body.providerProjectId;
  if (body.providerToken) updates.providerTokenEncrypted = encrypt(body.providerToken);
  if (body.providerTlsInsecure !== undefined) {
    updates.providerTlsInsecure = body.providerTlsInsecure;
  }
  if (body.providerCaCert !== undefined) {
    updates.providerCaCertEncrypted = body.providerCaCert?.trim()
      ? encrypt(body.providerCaCert.trim())
      : null;
  }
  if (body.imapHost) updates.imapHost = body.imapHost;
  if (body.imapPort) updates.imapPort = body.imapPort;
  if (body.imapSecure !== undefined) updates.imapSecure = body.imapSecure;
  if (body.imapUser) updates.imapUser = body.imapUser;
  if (body.imapPassword) updates.imapPasswordEncrypted = encrypt(body.imapPassword);
  if (body.smtpHost) updates.smtpHost = body.smtpHost;
  if (body.smtpPort) updates.smtpPort = body.smtpPort;
  if (body.smtpSecure !== undefined) updates.smtpSecure = body.smtpSecure;
  if (body.smtpUser) updates.smtpUser = body.smtpUser;
  if (body.smtpPassword) updates.smtpPasswordEncrypted = encrypt(body.smtpPassword);
  if (body.smtpFrom) updates.smtpFrom = body.smtpFrom;
  if (body.imapPollIntervalSeconds) updates.imapPollIntervalSeconds = body.imapPollIntervalSeconds;
  if (body.commentPollIntervalSeconds) updates.commentPollIntervalSeconds = body.commentPollIntervalSeconds;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.webhookEnabled !== undefined) updates.webhookEnabled = body.webhookEnabled;
  if (body.inboundAckEnabled !== undefined) updates.inboundAckEnabled = body.inboundAckEnabled;
  if (body.inboundAckTemplate) updates.inboundAckTemplate = body.inboundAckTemplate;

  const [updated] = await db
    .update(projects)
    .set(updates)
    .where(and(eq(projects.id, projectId), eq(projects.teamId, teamId)))
    .returning();

  if (!updated) return c.json({ error: "Not found" }, 404);

  await auditLog({
    teamId,
    userId,
    projectId,
    action: "update",
    resourceType: "project",
    resourceId: projectId,
  });

  return c.json(sanitizeProject(updated));
});

projectRoutes.delete("/:teamId/projects/:projectId", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  await auditLog({
    teamId,
    userId,
    projectId,
    action: "delete",
    resourceType: "project",
    resourceId: projectId,
  });

  await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.teamId, teamId)));

  return c.json({ ok: true });
});

projectRoutes.post("/:teamId/projects/:projectId/test-mail", async (c) => {
  const teamId = c.req.param("teamId");
  await requireTeamMember(c, teamId, "admin");
  const body = testMailConnectionSchema.parse(await c.req.json());

  const client = new ImapFlow({
    host: body.imapHost,
    port: body.imapPort,
    secure: body.imapSecure,
    auth: { user: body.imapUser, pass: body.imapPassword },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();

    const transporter = nodemailer.createTransport({
      host: body.smtpHost,
      port: body.smtpPort,
      secure: body.smtpSecure,
      auth: { user: body.smtpUser, pass: body.smtpPassword },
    });
    await transporter.verify();

    return c.json({ ok: true, imap: true, smtp: true });
  } catch (err) {
    return c.json(
      { ok: false, error: err instanceof Error ? err.message : "Connection failed" },
      400,
    );
  }
});

projectRoutes.post("/:teamId/projects/:projectId/test-provider", async (c) => {
  const teamId = c.req.param("teamId");
  await requireTeamMember(c, teamId, "admin");
  const body = testProviderConnectionSchema.parse(await c.req.json());

  try {
    const provider = createProvider(
      body.provider,
      toProviderConfig({
        baseUrl: body.providerBaseUrl,
        projectId: body.providerProjectId,
        token: body.providerToken,
        tlsInsecure: body.providerTlsInsecure,
        caCert: body.providerCaCert ?? null,
      }),
    );
    const user = await provider.getCurrentUser();
    return c.json({ ok: true, user });
  } catch (err) {
    return c.json(
      { ok: false, error: err instanceof Error ? err.message : "Connection failed" },
      400,
    );
  }
});

// Rules
projectRoutes.get("/:teamId/projects/:projectId/rules", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  await requireTeamMember(c, teamId);
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  const list = await db.query.rules.findMany({
    where: eq(rules.projectId, projectId),
  });

  return c.json({ rules: list });
});

projectRoutes.post("/:teamId/projects/:projectId/rules", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const body = createRuleSchema.parse(await c.req.json());
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  const [rule] = await db
    .insert(rules)
    .values({
      projectId,
      name: body.name,
      priority: body.priority,
      isEnabled: body.isEnabled,
      matchSender: body.matchSender ?? null,
      matchSubject: body.matchSubject ?? null,
      matchBody: body.matchBody ?? null,
      actionCreateIssue: body.actionCreateIssue,
      actionStatus: body.actionStatus ?? null,
      actionLabels: body.actionLabels,
      actionAssigneeId: body.actionAssigneeId ?? null,
    })
    .returning();

  await auditLog({
    teamId,
    userId,
    projectId,
    action: "create",
    resourceType: "rule",
    resourceId: rule!.id,
  });

  return c.json(rule, 201);
});

projectRoutes.patch("/:teamId/projects/:projectId/rules/:ruleId", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  const ruleId = c.req.param("ruleId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const body = updateRuleSchema.parse(await c.req.json());
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  const [updated] = await db
    .update(rules)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(rules.id, ruleId), eq(rules.projectId, projectId)))
    .returning();

  if (!updated) return c.json({ error: "Not found" }, 404);

  await auditLog({
    teamId,
    userId,
    projectId,
    action: "update",
    resourceType: "rule",
    resourceId: ruleId,
  });

  return c.json(updated);
});

projectRoutes.delete("/:teamId/projects/:projectId/rules/:ruleId", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  const ruleId = c.req.param("ruleId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const db = getDb();

  await db
    .delete(rules)
    .where(and(eq(rules.id, ruleId), eq(rules.projectId, projectId)));

  await auditLog({
    teamId,
    userId,
    projectId,
    action: "delete",
    resourceType: "rule",
    resourceId: ruleId,
  });

  return c.json({ ok: true });
});

projectRoutes.get("/:teamId/projects/:projectId/provider-options", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  await requireTeamMember(c, teamId);
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  try {
    const provider = createProjectProvider(project);
    const options = await provider.listProjectOptions();
    return c.json(options);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to fetch provider options" },
      400,
    );
  }
});

projectRoutes.get("/:teamId/projects/:projectId/mailbox-snapshot", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  await requireTeamMember(c, teamId);
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);

  try {
    const rawMessages = await fetchRecentMessages(projectMailCredentials(project), limit);
    const messages = await Promise.all(
      rawMessages.map(async (msg) => {
        const parsed = await parseEmail(msg.raw);
        return {
          uid: msg.uid,
          fromEmail: parsed.fromEmail,
          fromName: parsed.fromName,
          subject: parsed.subject,
          bodyPreview: parsed.body.slice(0, 300),
          body: parsed.body,
          messageId: parsed.messageId,
          date: parsed.date,
        };
      }),
    );

    return c.json({ messages });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to fetch mailbox snapshot" },
      400,
    );
  }
});

projectRoutes.post("/:teamId/projects/:projectId/rules/test", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  await requireTeamMember(c, teamId);
  const body = testRuleSchema.parse(await c.req.json());
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);

  try {
    const rawMessages = await fetchRecentMessages(projectMailCredentials(project), limit);
    const results = await Promise.all(
      rawMessages.map(async (msg) => {
        const email = await parseEmail(msg.raw);
        const matched = evaluateDraftRule(body, email);
        return {
          uid: msg.uid,
          fromEmail: email.fromEmail,
          fromName: email.fromName,
          subject: email.subject,
          bodyPreview: email.body.slice(0, 200),
          date: email.date,
          matched,
        };
      }),
    );

    return c.json({
      results,
      matchedCount: results.filter((r) => r.matched).length,
      total: results.length,
    });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to test rule" },
      400,
    );
  }
});

// Threads
projectRoutes.get("/:teamId/projects/:projectId/threads", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  await requireTeamMember(c, teamId);
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  const threads = await db.query.issueThreads.findMany({
    where: eq(issueThreads.projectId, projectId),
    with: { messages: true },
    orderBy: [desc(issueThreads.updatedAt)],
    limit: 100,
  });

  return c.json({ threads });
});

projectRoutes.get("/:teamId/projects/:projectId/threads/:threadId", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  const threadId = c.req.param("threadId");
  await requireTeamMember(c, teamId);
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  const thread = await db.query.issueThreads.findFirst({
    where: and(eq(issueThreads.id, threadId), eq(issueThreads.projectId, projectId)),
    with: { messages: true },
  });

  if (!thread) return c.json({ error: "Not found" }, 404);

  thread.messages.sort(
    (a, b) => new Date(a.processedAt).getTime() - new Date(b.processedAt).getTime(),
  );

  return c.json({ thread });
});

export { projectRoutes };
