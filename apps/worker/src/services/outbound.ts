import {
    decrypt,
    emailMessages,
    getDb,
    issueThreads,
    projects,
} from "@serviceboard/db";
import type { NormalizedWebhookEvent } from "@serviceboard/providers";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { buildOutboundMultipartContent } from "./email-content-outbound";
import {
    customerOutboundCc,
    latestThreadMessage,
    outboundEmailAddresses,
    quotedEmailFromStored,
    replyBodyWithQuote,
    threadingForParent,
} from "./email-thread";
import { createProjectProvider, projectProviderConfig } from "./provider";
import { sendEmail } from "./smtp";

export async function processOutboundComment(
  projectId: string,
  event: NormalizedWebhookEvent,
): Promise<void> {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project || !project.isActive) return;

  if (event.internal) {
    logger.debug({ noteId: event.noteId }, "skipping internal note");
    return;
  }

  if (project.providerBotUserId && event.authorId === project.providerBotUserId) {
    logger.debug({ noteId: event.noteId }, "skipping bot-authored note");
    return;
  }

  const existing = await db.query.emailMessages.findFirst({
    where: and(
      eq(emailMessages.projectId, projectId),
      eq(emailMessages.externalNoteId, event.noteId),
    ),
  });

  if (existing) {
    logger.debug({ noteId: event.noteId }, "note already processed");
    return;
  }

  const thread = await db.query.issueThreads.findFirst({
    where: and(
      eq(issueThreads.projectId, projectId),
      eq(issueThreads.externalIssueId, event.issueExternalId),
    ),
    with: { messages: true },
  });

  if (!thread) {
    logger.warn({ issueExternalId: event.issueExternalId }, "no thread found for issue");
    return;
  }

  const parent = latestThreadMessage(thread.messages);
  if (!parent) {
    logger.warn({ threadId: thread.id }, "no messages in thread for outbound reply");
    return;
  }

  const replyIntro = `${event.noteBody}

---
Reply from ${event.authorUsername} on issue #${thread.issueIid}
${thread.issueUrl}`;
  const body = replyBodyWithQuote(
    replyIntro,
    quotedEmailFromStored(parent, thread, project.smtpFrom),
  );
  const multipart = await buildOutboundMultipartContent(
    body,
    projectProviderConfig(project),
  );
  const { inReplyTo, references } = threadingForParent(
    parent.messageId,
    parent.references,
  );
  const cc = customerOutboundCc(project, thread.originalSenderEmail);
  const addresses = outboundEmailAddresses(
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
      subject: parent.subject ?? `Issue #${thread.issueIid}`,
      body: multipart.text,
      bodyHtml: multipart.html,
      attachments: multipart.attachments,
      inReplyTo,
      references,
    },
  );

  await db.insert(emailMessages).values({
    threadId: thread.id,
    projectId,
    direction: "outbound",
    messageId,
    inReplyTo,
    references,
    subject: parent.subject,
    bodyText: body,
    externalNoteId: event.noteId,
    ...addresses,
  });

  await db
    .update(issueThreads)
    .set({ lastSeenNoteAt: event.createdAt, updatedAt: new Date() })
    .where(eq(issueThreads.id, thread.id));

  try {
    const provider = createProjectProvider(project);
    await provider.addReaction(event.issueIid, event.noteId, "e-mail");
  } catch (err) {
    logger.warn({ err, noteId: event.noteId }, "failed to add email reaction to comment");
  }

  logger.info(
    { threadId: thread.id, noteId: event.noteId, inReplyTo, cc },
    "sent outbound email",
  );
}

export async function pollCommentsForProject(projectId: string): Promise<void> {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project || !project.isActive) return;

  const provider = createProjectProvider(project);

  const threads = await db.query.issueThreads.findMany({
    where: eq(issueThreads.projectId, projectId),
  });

  for (const thread of threads) {
    const since = thread.lastSeenNoteAt ?? thread.createdAt;
    const notes = await provider.listCommentsSince(thread.issueIid, since);

    for (const note of notes) {
      if (note.internal) continue;
      if (project.providerBotUserId && note.authorId === project.providerBotUserId) {
        continue;
      }

      const event: NormalizedWebhookEvent = {
        type: "note_created",
        issueExternalId: thread.externalIssueId,
        issueIid: thread.issueIid,
        noteId: note.id,
        noteBody: note.body,
        authorId: note.authorId,
        authorUsername: note.authorUsername,
        internal: note.internal,
        createdAt: note.createdAt,
      };

      await processOutboundComment(projectId, event);
    }
  }
}

export async function ensureWebhookForProject(projectId: string): Promise<void> {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) return;

  const webhookBase = process.env.WEBHOOK_BASE_URL ?? process.env.API_URL ?? "http://localhost:3000";
  const webhookUrl = `${webhookBase}/webhooks/gitlab/${projectId}`;

  const provider = createProjectProvider(project, {
    webhookUrl,
    webhookSecret: project.webhookSecret,
  });

  await provider.ensureWebhook(projectProviderConfig(project, {
    webhookUrl,
    webhookSecret: project.webhookSecret,
  }));

  logger.info({ projectId, webhookUrl }, "webhook ensured");
}
