import {
  dismissAllProjectStatusEvents,
  dismissProjectStatusEvent,
  encrypt,
  generateWebhookSecret,
  getDb,
  getProjectMessageVolume,
  issueThreads,
  listProjectStatusEvents,
  projects,
  rules,
} from "@servicebeard/db";
import { createProvider, toProviderConfig } from "@servicebeard/providers";
import {
  createProjectSchema,
  createRuleSchema,
  DEFAULT_CATCH_ALL_RULE,
  evaluateDraftRule,
  isEligibleForInboundRulePreview,
  normalizeProviderProjectId,
  testMailConnectionSchema,
  testProviderConnectionSchema,
  testRuleSchema,
  toInboundEligibility,
  updateProjectSchema,
  updateRuleSchema,
} from "@servicebeard/shared";
import { and, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { auditLog } from "../lib/auth";
import {
  testMailConnection,
  testProviderConnection,
} from "../lib/connection-test";
import { getEntitlements } from "../lib/entitlements";
import { providerFailureResponse } from "../lib/external-error";
import { fetchRecentMessages, parseEmail } from "../lib/mail";
import {
  createProjectProvider,
  enrichProviderProjectLabel,
  projectMailCredentials,
} from "../lib/provider";
import { getBoss, QUEUE_NAMES } from "../lib/queue";
import { loadProjectThreadMatchIndex } from "../lib/thread-match";
import type { AppVariables } from "../middleware/auth";
import { requireTeamMember } from "../middleware/team";

const projectRoutes = new Hono<{ Variables: AppVariables }>();

function projectWebhookUrl(project: { id: string; provider: string }): string {
  const base =
    process.env.WEBHOOK_BASE_URL ??
    process.env.API_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/webhooks/${project.provider}/${project.id}`;
}

function sanitizeProject(project: typeof projects.$inferSelect) {
  const {
    providerTokenEncrypted: _providerTokenEncrypted,
    providerCaCertEncrypted: _providerCaCertEncrypted,
    imapPasswordEncrypted: _imapPasswordEncrypted,
    smtpPasswordEncrypted: _smtpPasswordEncrypted,
    webhookSecret: _webhookSecret,
    webhookEnabled: _webhookEnabled,
    ...safe
  } = project;
  return { ...safe, webhookUrl: projectWebhookUrl(project) };
}

projectRoutes.get("/:teamId/projects", async (c) => {
  const teamId = c.req.param("teamId");
  await requireTeamMember(c, teamId);
  const db = getDb();

  const list = await db.query.projects.findMany({
    where: eq(projects.teamId, teamId),
  });

  const entitlements =
    await getEntitlements().getTeamEntitlementUsage?.(teamId);

  return c.json({
    projects: await Promise.all(
      list.map((project) =>
        enrichProviderProjectLabel(project, sanitizeProject(project)),
      ),
    ),
    entitlements: entitlements ?? null,
  });
});

projectRoutes.post("/:teamId/projects", async (c) => {
  const teamId = c.req.param("teamId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const db = getDb();

  const [{ value: projectCount }] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.teamId, teamId));
  await getEntitlements().assertCanCreateProject(teamId, projectCount);

  const body = createProjectSchema.parse(await c.req.json());
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
      providerTokenEncrypted: encrypt(body.providerToken ?? ""),
      providerGithubInstallationId:
        body.providerGithubInstallationId?.trim() || null,
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
    })
    .returning();

  const provider = createProvider(
    project!.provider,
    toProviderConfig({
      baseUrl: body.providerBaseUrl,
      projectId: body.providerProjectId,
      token: body.providerToken ?? "",
      githubInstallationId: body.providerGithubInstallationId?.trim() || null,
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

  await db.insert(rules).values({
    projectId: project!.id,
    name: DEFAULT_CATCH_ALL_RULE.name,
    priority: DEFAULT_CATCH_ALL_RULE.priority,
    isEnabled: DEFAULT_CATCH_ALL_RULE.isEnabled,
    matchSender: DEFAULT_CATCH_ALL_RULE.matchSender ?? null,
    matchSubject: DEFAULT_CATCH_ALL_RULE.matchSubject ?? null,
    matchBody: DEFAULT_CATCH_ALL_RULE.matchBody ?? null,
    actionCreateIssue: DEFAULT_CATCH_ALL_RULE.actionCreateIssue,
    actionStatus: DEFAULT_CATCH_ALL_RULE.actionStatus ?? null,
    actionLabels: DEFAULT_CATCH_ALL_RULE.actionLabels,
    actionAssigneeId: DEFAULT_CATCH_ALL_RULE.actionAssigneeId ?? null,
  });

  await auditLog({
    teamId,
    userId,
    projectId: project!.id,
    action: "create",
    resourceType: "project",
    resourceId: project!.id,
  });

  return c.json(
    await enrichProviderProjectLabel(project!, sanitizeProject(project!)),
    201,
  );
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
  const enriched = await enrichProviderProjectLabel(
    project,
    sanitizeProject(project),
  );
  return c.json({
    ...enriched,
    rules: project.rules,
    entitlements:
      (await getEntitlements().getTeamEntitlementUsage?.(teamId)) ?? null,
  });
});

projectRoutes.patch("/:teamId/projects/:projectId", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  const { userId } = await requireTeamMember(c, teamId, "admin");
  const body = updateProjectSchema.parse(await c.req.json());
  const db = getDb();

  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name) updates.name = body.name;
  if (body.slug) updates.slug = body.slug;
  if (body.provider) updates.provider = body.provider;
  if (body.providerBaseUrl) updates.providerBaseUrl = body.providerBaseUrl;
  if (body.providerProjectId) {
    updates.providerProjectId = normalizeProviderProjectId(
      body.provider ?? existing.provider,
      body.providerProjectId,
    );
  }
  if (body.providerToken)
    updates.providerTokenEncrypted = encrypt(body.providerToken);
  if (body.providerGithubInstallationId !== undefined) {
    updates.providerGithubInstallationId =
      body.providerGithubInstallationId.trim() || null;
  }
  if (body.providerGithubAuthType === "pat") {
    updates.providerGithubInstallationId = null;
  }
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
  if (body.imapPassword)
    updates.imapPasswordEncrypted = encrypt(body.imapPassword);
  if (body.smtpHost) updates.smtpHost = body.smtpHost;
  if (body.smtpPort) updates.smtpPort = body.smtpPort;
  if (body.smtpSecure !== undefined) updates.smtpSecure = body.smtpSecure;
  if (body.smtpUser) updates.smtpUser = body.smtpUser;
  if (body.smtpPassword)
    updates.smtpPasswordEncrypted = encrypt(body.smtpPassword);
  if (body.smtpFrom) updates.smtpFrom = body.smtpFrom;
  if (body.isActive !== undefined) {
    if (body.isActive && !existing.isActive) {
      const [{ value: activeCount }] = await db
        .select({ value: count() })
        .from(projects)
        .where(and(eq(projects.teamId, teamId), eq(projects.isActive, true)));
      await getEntitlements().assertCanActivateProject?.(teamId, activeCount);
    }
    updates.isActive = body.isActive;
  }
  if (body.inboundAckEnabled !== undefined)
    updates.inboundAckEnabled = body.inboundAckEnabled;
  if (body.inboundAckCcMailbox !== undefined)
    updates.inboundAckCcMailbox = body.inboundAckCcMailbox;
  if (body.inboundAckTemplate !== undefined)
    updates.inboundAckTemplate = body.inboundAckTemplate;
  if (body.outboundCommentTemplate !== undefined) {
    updates.outboundCommentTemplate = body.outboundCommentTemplate;
  }
  if (body.outboundCommentCcMailbox !== undefined) {
    updates.outboundCommentCcMailbox = body.outboundCommentCcMailbox;
  }
  if (body.inboundIssueTemplate !== undefined)
    updates.inboundIssueTemplate = body.inboundIssueTemplate;
  if (body.inboundCommentTemplate !== undefined) {
    updates.inboundCommentTemplate = body.inboundCommentTemplate;
  }
  if (body.imapMarkIngestedAsSeen !== undefined) {
    updates.imapMarkIngestedAsSeen = body.imapMarkIngestedAsSeen;
  }

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

  return c.json(
    await enrichProviderProjectLabel(updated, sanitizeProject(updated)),
  );
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
  const projectId = c.req.param("projectId");
  await requireTeamMember(c, teamId, "admin");
  const body = testMailConnectionSchema.parse(await c.req.json());

  try {
    return c.json(await testMailConnection(body));
  } catch (err) {
    return c.json(
      providerFailureResponse("test-mail", err, { projectId }),
      400,
    );
  }
});

projectRoutes.post("/:teamId/projects/:projectId/test-provider", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  await requireTeamMember(c, teamId, "admin");
  const body = testProviderConnectionSchema.parse(await c.req.json());

  try {
    return c.json(await testProviderConnection(body));
  } catch (err) {
    return c.json(
      providerFailureResponse("test-provider", err, { projectId }),
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
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  const [{ value: ruleCount }] = await db
    .select({ value: count() })
    .from(rules)
    .innerJoin(projects, eq(rules.projectId, projects.id))
    .where(eq(projects.teamId, teamId));
  await getEntitlements().assertCanCreateRule?.(teamId, ruleCount);

  const body = createRuleSchema.parse(await c.req.json());
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

  const existingRule = await db.query.rules.findFirst({
    where: and(eq(rules.id, ruleId), eq(rules.projectId, projectId)),
  });
  if (!existingRule) return c.json({ error: "Not found" }, 404);

  if (body.isEnabled === true && !existingRule.isEnabled) {
    const [{ value: enabledCount }] = await db
      .select({ value: count() })
      .from(rules)
      .innerJoin(projects, eq(rules.projectId, projects.id))
      .where(and(eq(projects.teamId, teamId), eq(rules.isEnabled, true)));
    await getEntitlements().assertCanEnableRule?.(teamId, enabledCount);
  }

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

projectRoutes.delete(
  "/:teamId/projects/:projectId/rules/:ruleId",
  async (c) => {
    const teamId = c.req.param("teamId");
    const projectId = c.req.param("projectId");
    const ruleId = c.req.param("ruleId");
    const { userId } = await requireTeamMember(c, teamId, "admin");
    const db = getDb();

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
    });
    if (!project) return c.json({ error: "Not found" }, 404);

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
  },
);

projectRoutes.get(
  "/:teamId/projects/:projectId/provider-options",
  async (c) => {
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
        {
          error:
            err instanceof Error
              ? err.message
              : "Failed to fetch provider options",
        },
        400,
      );
    }
  },
);

projectRoutes.get(
  "/:teamId/projects/:projectId/mailbox-snapshot",
  async (c) => {
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
      const rawMessages = await fetchRecentMessages(
        projectMailCredentials(project),
        limit,
      );
      const threadIndex = await loadProjectThreadMatchIndex(projectId);
      const inboundCtx = {
        supportEmail: project.smtpFrom,
        projectCreatedAt: project.createdAt,
      };
      const messages = [];
      for (const msg of rawMessages) {
        const parsed = await parseEmail(msg.raw);
        if (
          !isEligibleForInboundRulePreview(
            toInboundEligibility(parsed),
            inboundCtx,
            threadIndex,
          )
        ) {
          continue;
        }
        messages.push({
          uid: msg.uid,
          fromEmail: parsed.senderEmail,
          fromName: parsed.senderName,
          envelopeFromEmail: parsed.fromEmail,
          envelopeFromName: parsed.fromName,
          replyToEmail: parsed.replyToEmail,
          replyToName: parsed.replyToName,
          subject: parsed.subject,
          bodyPreview: parsed.body.slice(0, 300),
          body: parsed.body,
          messageId: parsed.messageId,
          inReplyTo: parsed.inReplyTo,
          references: parsed.references,
          toAddresses: parsed.toAddresses,
          ccAddresses: parsed.ccAddresses,
          bccAddresses: parsed.bccAddresses,
          date: parsed.date,
        });
      }

      return c.json({
        supportEmail: project.smtpFrom,
        projectCreatedAt: project.createdAt,
        messages,
      });
    } catch (err) {
      return c.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Failed to fetch mailbox snapshot",
        },
        400,
      );
    }
  },
);

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
    const rawMessages = await fetchRecentMessages(
      projectMailCredentials(project),
      limit,
    );
    const threadIndex = await loadProjectThreadMatchIndex(projectId);
    const inboundCtx = {
      supportEmail: project.smtpFrom,
      projectCreatedAt: project.createdAt,
    };
    const results = [];
    for (const msg of rawMessages) {
      const email = await parseEmail(msg.raw);
      if (
        !isEligibleForInboundRulePreview(
          toInboundEligibility(email),
          inboundCtx,
          threadIndex,
        )
      ) {
        continue;
      }
      results.push({
        uid: msg.uid,
        fromEmail: email.senderEmail,
        fromName: email.senderName,
        envelopeFromEmail: email.fromEmail,
        envelopeFromName: email.fromName,
        replyToEmail: email.replyToEmail,
        replyToName: email.replyToName,
        subject: email.subject,
        bodyPreview: email.body.slice(0, 200),
        date: email.date,
        matched: evaluateDraftRule(body, email),
      });
    }

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

// Project status events
projectRoutes.get("/:teamId/projects/:projectId/status-events", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  await requireTeamMember(c, teamId);
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  const events = await listProjectStatusEvents(projectId);
  return c.json({ events });
});

projectRoutes.post(
  "/:teamId/projects/:projectId/status-events/dismiss-all",
  async (c) => {
    const teamId = c.req.param("teamId");
    const projectId = c.req.param("projectId");
    await requireTeamMember(c, teamId, "admin");
    const db = getDb();

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
    });
    if (!project) return c.json({ error: "Not found" }, 404);

    const dismissed = await dismissAllProjectStatusEvents(projectId);
    return c.json({ ok: true, dismissed });
  },
);

projectRoutes.post(
  "/:teamId/projects/:projectId/status-events/:eventId/dismiss",
  async (c) => {
    const teamId = c.req.param("teamId");
    const projectId = c.req.param("projectId");
    const eventId = c.req.param("eventId");
    await requireTeamMember(c, teamId, "admin");
    const db = getDb();

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
    });
    if (!project) return c.json({ error: "Not found" }, 404);

    const dismissed = await dismissProjectStatusEvent(projectId, eventId);
    if (!dismissed) return c.json({ error: "Not found" }, 404);

    return c.json({ ok: true });
  },
);

projectRoutes.get("/:teamId/projects/:projectId/message-volume", async (c) => {
  const teamId = c.req.param("teamId");
  const projectId = c.req.param("projectId");
  await requireTeamMember(c, teamId);
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.teamId, teamId)),
  });
  if (!project) return c.json({ error: "Not found" }, 404);

  const rawDays = Number(c.req.query("days") ?? "30");
  const days =
    rawDays === 7 || rawDays === 30 || rawDays === 365 ? rawDays : 30;
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const points = await getProjectMessageVolume(projectId, since);
  return c.json({ days, points });
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
    with: {
      messages: true,
      matchedRule: {
        columns: { id: true, name: true },
      },
    },
    orderBy: [desc(issueThreads.updatedAt)],
    limit: 100,
  });

  return c.json({
    threads: threads.map(({ matchedRule, ...thread }) => ({
      ...thread,
      matchedRuleName: matchedRule?.name ?? null,
    })),
  });
});

projectRoutes.get(
  "/:teamId/projects/:projectId/threads/:threadId",
  async (c) => {
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
      where: and(
        eq(issueThreads.id, threadId),
        eq(issueThreads.projectId, projectId),
      ),
      with: { messages: true },
    });

    if (!thread) return c.json({ error: "Not found" }, 404);

    thread.messages.sort(
      (a, b) =>
        new Date(a.processedAt).getTime() - new Date(b.processedAt).getTime(),
    );

    return c.json({ thread });
  },
);

export { projectRoutes };
