import {
  closeDb,
  createDb,
  emailMessages,
  encrypt,
  generateWebhookSecret,
  issueThreads,
  projects,
  rules,
  teamMembers,
  teams,
  userAuthProviders,
  users,
} from "@servicebeard/db";
import { and, eq } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  E2E_PASSWORD,
  E2E_PROJECTS,
  E2E_RULES,
  E2E_TEAMS,
  E2E_THREAD,
  E2E_USERS,
  localExternalSub,
  SEED_DATA_PATH,
} from "./constants";
import type { SeedData, SeedUserKey } from "./types";

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 });
}

async function ensureUser(
  key: SeedUserKey,
  email: string,
  name: string,
  isAdmin: boolean,
): Promise<{ id: string; email: string; name: string }> {
  const db = createDb().db;
  const externalSub = localExternalSub(email);
  const passwordHash = await hashPassword(E2E_PASSWORD);

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    await db
      .update(users)
      .set({
        name,
        passwordHash,
        isAdmin,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));

    const linked = await db.query.userAuthProviders.findFirst({
      where: and(
        eq(userAuthProviders.userId, existing.id),
        eq(userAuthProviders.provider, "local"),
      ),
    });
    if (!linked) {
      await db.insert(userAuthProviders).values({
        userId: existing.id,
        provider: "local",
        externalSub,
      });
    }

    return { id: existing.id, email, name };
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      name,
      oidcSub: externalSub,
      passwordHash,
      isAdmin,
      emailVerifiedAt: new Date(),
    })
    .returning();

  await db.insert(userAuthProviders).values({
    userId: created!.id,
    provider: "local",
    externalSub,
  });

  return { id: created!.id, email, name };
}

async function ensureTeam(name: string, slug: string) {
  const db = createDb().db;
  const existing = await db.query.teams.findFirst({
    where: eq(teams.slug, slug),
  });
  if (existing) {
    await db
      .update(teams)
      .set({ name, updatedAt: new Date() })
      .where(eq(teams.id, existing.id));
    return existing;
  }
  const [created] = await db.insert(teams).values({ name, slug }).returning();
  return created!;
}

async function ensureMembership(
  teamId: string,
  userId: string,
  role: "owner" | "admin" | "member",
) {
  const db = createDb().db;
  const existing = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
  });
  if (existing) {
    if (existing.role !== role) {
      await db
        .update(teamMembers)
        .set({ role })
        .where(eq(teamMembers.id, existing.id));
    }
    return;
  }
  await db.insert(teamMembers).values({ teamId, userId, role });
}

async function ensureProject(
  teamId: string,
  name: string,
  slug: string,
  fallbackWebhookSecret: string,
) {
  const db = createDb().db;
  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.teamId, teamId), eq(projects.slug, slug)),
  });

  const projectValues = {
    teamId,
    name,
    slug,
    provider: "gitlab" as const,
    providerBaseUrl: "https://gitlab.example.com",
    providerProjectId: "123",
    providerTokenEncrypted: encrypt("e2e-token"),
    imapHost: "localhost",
    imapPort: 3143,
    imapSecure: false,
    imapUser: "e2e@test.local",
    imapPasswordEncrypted: encrypt("imap-pass"),
    smtpHost: "localhost",
    smtpPort: 3025,
    smtpSecure: false,
    smtpUser: "e2e@test.local",
    smtpPasswordEncrypted: encrypt("smtp-pass"),
    smtpFrom: "e2e@test.local",
    webhookSecret: fallbackWebhookSecret,
    webhookEnabled: true,
    isActive: true,
  };

  if (existing) {
    await db
      .update(projects)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, existing.id));
    return existing;
  }

  const [created] = await db.insert(projects).values(projectValues).returning();
  return created!;
}

async function ensureRule(projectId: string, name: string) {
  const db = createDb().db;
  const existing = await db.query.rules.findFirst({
    where: and(eq(rules.projectId, projectId), eq(rules.name, name)),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(rules)
    .values({
      projectId,
      name,
      priority: 0,
      isEnabled: true,
      matchSender: "support@example.com",
      actionCreateIssue: true,
      actionLabels: ["e2e"],
    })
    .returning();
  return created!;
}

async function ensureThread(
  projectId: string,
  ruleId: string,
  threadKey: keyof typeof E2E_THREAD,
) {
  const threadDef = E2E_THREAD[threadKey];
  const db = createDb().db;
  const existing = await db.query.issueThreads.findFirst({
    where: and(
      eq(issueThreads.projectId, projectId),
      eq(issueThreads.externalIssueId, threadDef.externalIssueId),
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(issueThreads)
    .values({
      projectId,
      externalIssueId: threadDef.externalIssueId,
      issueIid: threadDef.issueIid,
      issueUrl: threadDef.issueUrl,
      originalSenderEmail: threadDef.originalSenderEmail,
      originalSenderName: threadDef.originalSenderName,
      subjectNormalized: threadDef.subjectNormalized,
      matchedRuleId: ruleId,
    })
    .returning();

  const messageId = `<e2e-seed-${threadKey}-${projectId}@test.local>`;
  const existingMessage = await db.query.emailMessages.findFirst({
    where: and(
      eq(emailMessages.projectId, projectId),
      eq(emailMessages.messageId, messageId),
    ),
  });
  if (!existingMessage) {
    await db.insert(emailMessages).values({
      threadId: created!.id,
      projectId,
      direction: "inbound",
      messageId,
      subject: threadDef.subject,
      bodyText: "E2E seeded inbound message",
      fromAddress: threadDef.originalSenderEmail,
      toAddresses: ["support@example.com"],
    });
  }

  return created!;
}

export async function seedE2EData(): Promise<SeedData> {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY must be set for e2e seeding");
  }

  const webhookSecretA = generateWebhookSecret();
  const webhookSecretB = generateWebhookSecret();

  const seededUsers = {
    ownerA: await ensureUser(
      "ownerA",
      E2E_USERS.ownerA.email,
      E2E_USERS.ownerA.name,
      false,
    ),
    adminA: await ensureUser(
      "adminA",
      E2E_USERS.adminA.email,
      E2E_USERS.adminA.name,
      false,
    ),
    memberA: await ensureUser(
      "memberA",
      E2E_USERS.memberA.email,
      E2E_USERS.memberA.name,
      false,
    ),
    ownerB: await ensureUser(
      "ownerB",
      E2E_USERS.ownerB.email,
      E2E_USERS.ownerB.name,
      false,
    ),
    outsider: await ensureUser(
      "outsider",
      E2E_USERS.outsider.email,
      E2E_USERS.outsider.name,
      false,
    ),
    platformAdmin: await ensureUser(
      "platformAdmin",
      E2E_USERS.platformAdmin.email,
      E2E_USERS.platformAdmin.name,
      true,
    ),
  };

  const teamA = await ensureTeam(E2E_TEAMS.teamA.name, E2E_TEAMS.teamA.slug);
  const teamB = await ensureTeam(E2E_TEAMS.teamB.name, E2E_TEAMS.teamB.slug);

  await ensureMembership(teamA.id, seededUsers.ownerA.id, "owner");
  await ensureMembership(teamA.id, seededUsers.adminA.id, "admin");
  await ensureMembership(teamA.id, seededUsers.memberA.id, "member");
  await ensureMembership(teamB.id, seededUsers.ownerB.id, "owner");

  const projectA = await ensureProject(
    teamA.id,
    E2E_PROJECTS.projectA.name,
    E2E_PROJECTS.projectA.slug,
    webhookSecretA,
  );
  const projectB = await ensureProject(
    teamB.id,
    E2E_PROJECTS.projectB.name,
    E2E_PROJECTS.projectB.slug,
    webhookSecretB,
  );

  const ruleA = await ensureRule(projectA.id, E2E_RULES.ruleA.name);
  const ruleB = await ensureRule(projectB.id, E2E_RULES.ruleB.name);

  const threadA = await ensureThread(projectA.id, ruleA.id, "threadA");
  const threadB = await ensureThread(projectB.id, ruleB.id, "threadB");

  const data: SeedData = {
    users: seededUsers,
    teams: {
      teamA: { id: teamA.id, slug: teamA.slug, name: teamA.name },
      teamB: { id: teamB.id, slug: teamB.slug, name: teamB.name },
    },
    projects: {
      projectA: {
        id: projectA.id,
        slug: projectA.slug,
        name: projectA.name,
        webhookSecret: projectA.webhookSecret,
      },
      projectB: {
        id: projectB.id,
        slug: projectB.slug,
        name: projectB.name,
        webhookSecret: projectB.webhookSecret,
      },
    },
    rules: {
      ruleA: { id: ruleA.id, name: ruleA.name },
      ruleB: { id: ruleB.id, name: ruleB.name },
    },
    threads: {
      threadA: {
        id: threadA.id,
        subject: E2E_THREAD.threadA.subject,
        externalIssueId: E2E_THREAD.threadA.externalIssueId,
      },
      threadB: {
        id: threadB.id,
        subject: E2E_THREAD.threadB.subject,
        externalIssueId: E2E_THREAD.threadB.externalIssueId,
      },
    },
    password: E2E_PASSWORD,
  };

  mkdirSync(dirname(SEED_DATA_PATH), { recursive: true });
  writeFileSync(SEED_DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`E2E seed data written to ${SEED_DATA_PATH}`);

  await closeDb();
  return data;
}

if (import.meta.main) {
  seedE2EData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
