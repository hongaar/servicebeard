import {
    decrypt,
    emailMessages,
    getDb,
    issueThreads,
    projects,
} from "@serviceboard/db";
import { normalizeSubject, renderInboundAckTemplate } from "@serviceboard/shared";
import { and, eq, inArray, or } from "drizzle-orm";
import { logger } from "../lib/logger";
import { resolveEmailMarkdown } from "./email-content";
import {
    customerOutboundCc,
    inboundEmailAddresses,
    outboundEmailAddresses,
    quotedEmailFromParsed,
    replyBodyWithQuote,
    threadingForParent,
} from "./email-thread";
import { fetchUnseenMessages, markMessageSeen, parseEmail } from "./mail";
import { createProjectProvider } from "./provider";
import {
    evaluateRules,
    formatCommentBody,
    formatIssueDescription,
    type ParsedEmail,
} from "./rules";
import { sendEmail } from "./smtp";

/** Only process emails sent on or after the project was created. */
export function isEmailEligibleForInboundSync(
  emailDate: Date,
  projectCreatedAt: Date,
): boolean {
  return emailDate.getTime() >= projectCreatedAt.getTime();
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

  const messages = await fetchUnseenMessages(creds);
  logger.info({ projectId, count: messages.length }, "fetched unseen messages");

  for (const { uid, raw, internalDate } of messages) {
    try {
      const email = await parseEmail(raw, internalDate);

      if (!isEmailEligibleForInboundSync(email.date, project.createdAt)) {
        logger.debug(
          { projectId, uid, messageId: email.messageId, emailDate: email.date },
          "skipping pre-project email",
        );
        await markMessageSeen(creds, uid);
        continue;
      }

      await processInboundEmail(projectId, email);
      await markMessageSeen(creds, uid);
    } catch (err) {
      logger.error({ err, projectId, uid }, "failed to process message");
    }
  }

  await db
    .update(projects)
    .set({ lastImapPollAt: new Date() })
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
    const markdownBody = await resolveEmailMarkdown(email, provider);
    const commentBody = formatCommentBody(email, markdownBody);
    const result = await provider.addComment(thread.issueIid, commentBody, {
      internal: true,
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
      .set({ updatedAt: new Date() })
      .where(eq(issueThreads.id, thread.id));

    logger.info({ threadId: thread.id, messageId: email.messageId }, "added comment to existing thread");
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

  const tempThreadId = crypto.randomUUID();
  const markdownBody = await resolveEmailMarkdown(email, provider);
  const description = formatIssueDescription(email, tempThreadId, markdownBody);

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
  const cc = customerOutboundCc(project, thread.originalSenderEmail);

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
