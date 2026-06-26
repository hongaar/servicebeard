import {
    decrypt,
    emailMessages,
    getDb,
    issueThreads,
    projectImapIngestedMessages,
    projects,
} from "@servicebeard/db";
import {
    isEligibleForInboundRuleEvaluation,
    isEmailEligibleForInboundSync,
    normalizeSubject,
    renderInboundAckTemplate,
    resolveServicebeardWebUrl,
    type ProviderType,
} from "@servicebeard/shared";
import { getEntitlements } from "@servicebeard/shared/entitlements";
import { and, count, eq, gte, inArray, lt, or } from "drizzle-orm";
import { logExternalError } from "../lib/external-error";
import { logger } from "../lib/logger";
import { resolveEmailMarkdown } from "./email-content";
import {
    inboundAckCc,
    inboundEmailAddresses,
    outboundEmailAddresses,
    quotedEmailFromParsed,
    replyBodyWithQuote,
    threadingForParent,
} from "./email-thread";
import { fetchInboxMessagesSince, markMessageSeen, parseEmail } from "./mail";
import { createProjectProvider } from "./provider";
import {
    evaluateRules,
    formatCommentBody,
    formatIssueDescription,
    type ParsedEmail,
} from "./rules";
import { sendEmail } from "./smtp";

/** Re-scan this far before the ingest watermark to tolerate out-of-order delivery. */
export const IMAP_POLL_OVERLAP_MS = 24 * 60 * 60 * 1000;

export { isEmailEligibleForInboundSync } from "@servicebeard/shared";

export function computeImapPollSince(
  projectCreatedAt: Date,
  imapIngestedThrough: Date | null,
): Date {
  const floor = projectCreatedAt.getTime();
  if (!imapIngestedThrough) {
    return new Date(floor);
  }
  return new Date(Math.max(floor, imapIngestedThrough.getTime() - IMAP_POLL_OVERLAP_MS));
}

export function advanceImapIngestedThrough(
  current: Date | null,
  scannedThrough: Date | null,
): Date | null {
  if (!scannedThrough) return current;
  if (!current) return scannedThrough;
  return scannedThrough.getTime() > current.getTime() ? scannedThrough : current;
}

export async function loadIngestedMessageIds(
  projectId: string,
  ingestedSince?: Date,
): Promise<Set<string>> {
  const db = getDb();
  const where = ingestedSince
    ? and(
        eq(projectImapIngestedMessages.projectId, projectId),
        gte(projectImapIngestedMessages.ingestedAt, ingestedSince),
      )
    : eq(projectImapIngestedMessages.projectId, projectId);

  const rows = await db
    .select({ messageId: projectImapIngestedMessages.messageId })
    .from(projectImapIngestedMessages)
    .where(where);

  return new Set(rows.map((row) => row.messageId));
}

export async function recordIngestedMessage(
  projectId: string,
  messageId: string,
): Promise<void> {
  const db = getDb();
  await db
    .insert(projectImapIngestedMessages)
    .values({ projectId, messageId })
    .onConflictDoNothing({
      target: [
        projectImapIngestedMessages.projectId,
        projectImapIngestedMessages.messageId,
      ],
    });
}

export async function processImapPoll(projectId: string): Promise<void> {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project || !project.isActive) return;

  const creds = {
    imapHost: project.imapHost,
    imapPort: project.imapPort,
    imapSecure: project.imapSecure,
    imapUser: project.imapUser,
    imapPassword: decrypt(project.imapPasswordEncrypted),
  };

  const pollSince = computeImapPollSince(project.createdAt, project.imapIngestedThrough);
  const ingestedMessageIds = await loadIngestedMessageIds(projectId, pollSince);

  let fetchResult;
  try {
    fetchResult = await fetchInboxMessagesSince(
      creds,
      pollSince,
      ingestedMessageIds,
      { projectId },
    );
  } catch (err) {
    logExternalError("imap", "poll", err, { projectId });
    throw err;
  }

  const { messages, scannedThrough } = fetchResult;

  logger.info(
    { projectId, count: messages.length, pollSince, scannedThrough },
    "fetched inbox messages",
  );

  for (const { uid, raw, internalDate } of messages) {
    try {
      const email = await parseEmail(raw, internalDate);

      if (ingestedMessageIds.has(email.messageId)) {
        continue;
      }

      if (!isEmailEligibleForInboundSync(email.date, project.createdAt)) {
        logger.debug(
          { projectId, uid, messageId: email.messageId, emailDate: email.date },
          "skipping pre-project email",
        );
        await recordIngestedMessage(projectId, email.messageId);
        ingestedMessageIds.add(email.messageId);
        if (project.imapMarkIngestedAsSeen) {
          await markMessageSeen(creds, uid, { projectId });
        }
        continue;
      }

      await processInboundEmail(projectId, email);
      await recordIngestedMessage(projectId, email.messageId);
      ingestedMessageIds.add(email.messageId);
      if (project.imapMarkIngestedAsSeen) {
        await markMessageSeen(creds, uid, { projectId });
      }
    } catch (err) {
      logExternalError("inbound", "process-message", err, { projectId, uid });
    }
  }

  const imapIngestedThrough = advanceImapIngestedThrough(
    project.imapIngestedThrough,
    scannedThrough,
  );

  await db
    .update(projects)
    .set({
      lastImapPollAt: new Date(),
      ...(imapIngestedThrough ? { imapIngestedThrough } : {}),
    })
    .where(eq(projects.id, projectId));
}

export async function processInboundEmail(
  projectId: string,
  email: ParsedEmail,
): Promise<void> {
  const db = getDb();

  const existing = await db.query.emailMessages.findFirst({
    where: and(
      eq(emailMessages.projectId, projectId),
      eq(emailMessages.messageId, email.messageId),
    ),
  });

  if (existing) {
    logger.debug({ messageId: email.messageId }, "duplicate message, skipping");
    return;
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: { rules: true },
  });

  if (!project) return;

  const thread = await findThread(projectId, email);

  const provider = createProjectProvider(project);

  const addresses = inboundEmailAddresses(email);

  if (thread) {
    const markdownBody = await resolveEmailMarkdown(email, provider, projectId);
    const commentBody = formatCommentBody(email, project.inboundCommentTemplate, markdownBody);
    const result = await provider.addComment(thread.issueIid, commentBody, {
      internal: false,
    });

    await db.insert(emailMessages).values({
      threadId: thread.id,
      projectId,
      direction: "inbound",
      messageId: email.messageId,
      inReplyTo: email.inReplyTo,
      references: email.references,
      subject: email.subject,
      bodyText: email.body,
      externalNoteId: result.noteId,
      ...addresses,
    });

    await db
      .update(issueThreads)
      .set({ lastSeenNoteAt: result.createdAt, updatedAt: new Date() })
      .where(eq(issueThreads.id, thread.id));

    logger.info({ threadId: thread.id, messageId: email.messageId }, "added comment to existing thread");
    return;
  }

  if (
    !isEligibleForInboundRuleEvaluation(email, {
      supportEmail: project.smtpFrom,
      projectCreatedAt: project.createdAt,
    })
  ) {
    logger.info({ messageId: email.messageId }, "skipping mail ineligible for new issue rules");
    return;
  }

  const { matched, rule } = evaluateRules(
    project.rules.map((r: (typeof project.rules)[number]) => ({
      ...r,
      actionLabels: r.actionLabels ?? [],
    })),
    email,
  );

  if (!matched || !rule?.actionCreateIssue) {
    logger.info({ messageId: email.messageId }, "no matching rule or create disabled");
    return;
  }

  const billingPeriod = await getEntitlements().getBillingPeriod?.(project.teamId);
  const periodStart =
    billingPeriod?.start ??
    (() => {
      const fallback = new Date();
      fallback.setUTCDate(1);
      fallback.setUTCHours(0, 0, 0, 0);
      return fallback;
    })();
  const periodEnd = billingPeriod?.end;
  const [{ value: conversationsThisMonth }] = await db
    .select({ value: count() })
    .from(issueThreads)
    .innerJoin(projects, eq(issueThreads.projectId, projects.id))
    .where(
      and(
        eq(projects.teamId, project.teamId),
        gte(issueThreads.createdAt, periodStart),
        ...(periodEnd ? [lt(issueThreads.createdAt, periodEnd)] : []),
      ),
    );
  try {
    await getEntitlements().assertCanCreateConversation?.(project.teamId, conversationsThisMonth);
  } catch (err) {
    if (err instanceof Error && err.message === "CONVERSATION_LIMIT_REACHED") {
      logger.info(
        { teamId: project.teamId },
        "monthly conversation limit reached, skipping new issue",
      );
      return;
    }
    throw err;
  }

  const tempThreadId = crypto.randomUUID();
  const markdownBody = await resolveEmailMarkdown(email, provider);
  const description = formatIssueDescription(
    email,
    tempThreadId,
    project.inboundIssueTemplate,
    markdownBody,
    {
      webUrl: resolveServicebeardWebUrl(),
      teamId: project.teamId,
      projectId: project.id,
      provider: project.provider as ProviderType,
    },
  );

  const issue = await provider.createIssue({
    title: email.subject,
    description,
    labels: rule.actionLabels,
    assigneeId: rule.actionAssigneeId,
    status: rule.actionStatus,
  });

  const [threadRecord] = await db
    .insert(issueThreads)
    .values({
      projectId,
      externalIssueId: issue.externalId,
      issueIid: issue.iid,
      issueUrl: issue.url,
      originalSenderEmail: email.fromEmail,
      originalSenderName: email.fromName,
      subjectNormalized: normalizeSubject(email.subject),
    })
    .returning();

  await db.insert(emailMessages).values({
    threadId: threadRecord!.id,
    projectId,
    direction: "inbound",
    messageId: email.messageId,
    inReplyTo: email.inReplyTo,
    references: email.references,
    subject: email.subject,
    bodyText: email.body,
    ...addresses,
  });

  if (project.inboundAckEnabled) {
    await sendInboundAckEmail(project, threadRecord!, email, issue);
  }

  logger.info(
    { threadId: threadRecord!.id, issueIid: issue.iid },
    "created new issue from email",
  );
}

async function sendInboundAckEmail(
  project: typeof projects.$inferSelect,
  thread: typeof issueThreads.$inferSelect,
  email: ParsedEmail,
  issue: { iid: number; url: string },
): Promise<void> {
  const db = getDb();
  const ackBody = renderInboundAckTemplate(project.inboundAckTemplate, {
    senderName: email.fromName ?? email.fromEmail,
    senderEmail: email.fromEmail,
    subject: email.subject,
    issueNumber: issue.iid,
    issueUrl: issue.url,
  });
  const body = replyBodyWithQuote(ackBody, quotedEmailFromParsed(email));

  const { inReplyTo, references } = threadingForParent(
    email.messageId,
    email.references,
  );
  const cc = inboundAckCc(project, thread.originalSenderEmail);

  const ackAddresses = outboundEmailAddresses(
    project.smtpFrom,
    thread.originalSenderEmail,
    thread.originalSenderName,
    cc,
  );

  const messageId = await sendEmail(
    {
      smtpHost: project.smtpHost,
      smtpPort: project.smtpPort,
      smtpSecure: project.smtpSecure,
      smtpUser: project.smtpUser,
      smtpPassword: decrypt(project.smtpPasswordEncrypted),
      smtpFrom: project.smtpFrom,
    },
    {
      to: thread.originalSenderEmail,
      toName: thread.originalSenderName,
      cc,
      subject: email.subject,
      body,
      inReplyTo,
      references,
    },
    { projectId: project.id },
  );

  await db.insert(emailMessages).values({
    threadId: thread.id,
    projectId: project.id,
    direction: "outbound",
    messageId,
    inReplyTo,
    references,
    subject: email.subject,
    bodyText: body,
    ...ackAddresses,
  });

  logger.info(
    { threadId: thread.id, messageId, inReplyTo, cc },
    "sent inbound acknowledgement email",
  );
}

async function findThread(
  projectId: string,
  email: ParsedEmail,
): Promise<typeof issueThreads.$inferSelect | null> {
  const db = getDb();

  const refIds = [
    ...(email.inReplyTo ? [email.inReplyTo] : []),
    ...email.references,
  ];

  if (refIds.length > 0) {
    const byRef = await db.query.emailMessages.findFirst({
      where: and(
        eq(emailMessages.projectId, projectId),
        or(
          inArray(emailMessages.messageId, refIds),
          ...refIds.map((r) => eq(emailMessages.inReplyTo, r)),
        ),
      ),
      with: { thread: true },
    });

    if (byRef?.thread) return byRef.thread;
  }

  const subjectNorm = normalizeSubject(email.subject);
  const bySubject = await db.query.issueThreads.findFirst({
    where: and(
      eq(issueThreads.projectId, projectId),
      eq(issueThreads.subjectNormalized, subjectNorm),
      eq(issueThreads.originalSenderEmail, email.fromEmail),
    ),
  });

  return bySubject ?? null;
}
