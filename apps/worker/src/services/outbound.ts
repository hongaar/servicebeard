import {
  decrypt,
  emailMessages,
  getDb,
  issueThreads,
  projects,
} from "@servicebeard/db";
import {
  GitHubProvider,
  isProviderRateLimitError,
  type NormalizedWebhookEvent,
} from "@servicebeard/providers";
import {
  formatSendOutboundEmailSuccess,
  isServicebeardInternalContent,
  isServicebeardSyncedContent,
  renderOutboundCommentTemplate,
} from "@servicebeard/shared";
import { and, eq, isNull } from "drizzle-orm";
import {
  logExternalError,
  recordProjectSyncEvent,
} from "../lib/external-error";
import { logger } from "../lib/logger";
import { coerceDate } from "../lib/dates";
import { releaseNoteLock, tryAcquireNoteLock } from "../lib/note-lock";
import { buildOutboundMultipartContent } from "./email-content-outbound";
import { applyEmailStyleToHtml } from "./email-style-apply";
import {
  latestThreadMessage,
  outboundCommentCc,
  outboundEmailAddresses,
  quotedEmailFromStored,
  replyBodyWithQuote,
  threadingForParent,
} from "./email-thread";
import { createProjectProvider, projectProviderConfig } from "./provider";
import { sendEmail } from "./smtp";

async function advanceLastSeenNoteAt(
  threadId: string,
  noteCreatedAt: Date | string,
): Promise<void> {
  const noteAt = coerceDate(noteCreatedAt);
  const db = getDb();
  const thread = await db.query.issueThreads.findFirst({
    where: eq(issueThreads.id, threadId),
  });
  if (!thread) return;

  const current = thread.lastSeenNoteAt;
  if (current && current.getTime() >= noteAt.getTime()) return;

  await db
    .update(issueThreads)
    .set({ lastSeenNoteAt: noteAt, updatedAt: new Date() })
    .where(eq(issueThreads.id, threadId));
}

async function advanceLastSeenNoteAtForIssue(
  projectId: string,
  issueExternalId: string,
  noteCreatedAt: Date | string,
): Promise<void> {
  const db = getDb();
  const thread = await db.query.issueThreads.findFirst({
    where: and(
      eq(issueThreads.projectId, projectId),
      eq(issueThreads.externalIssueId, issueExternalId),
    ),
  });
  if (!thread) return;
  await advanceLastSeenNoteAt(thread.id, noteCreatedAt);
}

function outboundSkipReason(
  _project: typeof projects.$inferSelect,
  noteBody: string,
  _authorId: string,
  internal: boolean,
  system: boolean,
): string | null {
  if (internal) return "internal";
  if (system) return "system";
  if (isServicebeardInternalContent(noteBody)) return "internal_marker";
  if (isServicebeardSyncedContent(noteBody)) return "sync_marker";
  return null;
}

function commentAuthorDisplayName(event: {
  authorName: string | null;
  authorUsername: string;
}): string {
  return event.authorName?.trim() || event.authorUsername;
}

export async function processOutboundComment(
  projectId: string,
  event: NormalizedWebhookEvent & { createdAt: Date | string },
): Promise<void> {
  const lockAcquired = await tryAcquireNoteLock(projectId, event.noteId);
  if (!lockAcquired) {
    logger.debug(
      { projectId, noteId: event.noteId },
      "skipping outbound comment, note already being processed",
    );
    return;
  }

  try {
    await processOutboundCommentLocked(projectId, event);
  } finally {
    await releaseNoteLock(projectId, event.noteId);
  }
}

async function processOutboundCommentLocked(
  projectId: string,
  event: NormalizedWebhookEvent & { createdAt: Date | string },
): Promise<void> {
  const noteCreatedAt = coerceDate(event.createdAt);
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  logger.debug(
    {
      projectId,
      noteId: event.noteId,
      issueIid: event.issueIid,
      issueExternalId: event.issueExternalId,
      authorId: event.authorId,
      authorUsername: event.authorUsername,
      internal: event.internal,
      system: event.system,
      createdAt: noteCreatedAt,
      bodyPreview: event.noteBody.slice(0, 120),
    },
    "processing outbound comment",
  );

  if (!project || !project.isActive) {
    logger.debug(
      { projectId, noteId: event.noteId },
      "skipping outbound comment, project inactive or missing",
    );
    return;
  }

  if (event.internal) {
    logger.debug({ noteId: event.noteId }, "skipping internal note");
    await advanceLastSeenNoteAtForIssue(
      projectId,
      event.issueExternalId,
      noteCreatedAt,
    );
    return;
  }

  if (event.system) {
    logger.debug({ noteId: event.noteId }, "skipping system note");
    await advanceLastSeenNoteAtForIssue(
      projectId,
      event.issueExternalId,
      noteCreatedAt,
    );
    return;
  }

  const skipReason = outboundSkipReason(
    project,
    event.noteBody,
    event.authorId,
    event.internal,
    event.system,
  );
  if (skipReason === "internal_marker") {
    logger.debug({ noteId: event.noteId }, "skipping internal marker comment");
    await advanceLastSeenNoteAtForIssue(
      projectId,
      event.issueExternalId,
      noteCreatedAt,
    );
    return;
  }

  if (skipReason === "sync_marker") {
    logger.debug({ noteId: event.noteId }, "skipping email-synced comment");
    await advanceLastSeenNoteAtForIssue(
      projectId,
      event.issueExternalId,
      noteCreatedAt,
    );
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
    await advanceLastSeenNoteAtForIssue(
      projectId,
      event.issueExternalId,
      noteCreatedAt,
    );
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
    logger.warn(
      { issueExternalId: event.issueExternalId },
      "no thread found for issue",
    );
    return;
  }

  const parent = latestThreadMessage(thread.messages);
  if (!parent) {
    logger.warn(
      { threadId: thread.id },
      "no messages in thread for outbound reply",
    );
    return;
  }

  const provider = createProjectProvider(project);
  const authorDisplayName =
    provider instanceof GitHubProvider
      ? await provider.resolveAuthorDisplayName(event)
      : commentAuthorDisplayName(event);

  const replyIntro = renderOutboundCommentTemplate(
    project.outboundCommentTemplate,
    {
      commentBody: event.noteBody,
      authorName: authorDisplayName,
      issueNumber: thread.issueIid,
      issueUrl: thread.issueUrl,
    },
  );
  const quoted = quotedEmailFromStored(parent, thread, project.smtpFrom);
  const body = replyBodyWithQuote(replyIntro, quoted);
  const imageDownloadUrlOverrides =
    provider instanceof GitHubProvider
      ? await provider.resolveCommentImageDownloads(
          thread.issueIid,
          event.noteId,
          event.noteBody,
        )
      : undefined;
  const outboundOptions = {
    imageSource: replyIntro,
    imageDownloadUrlOverrides,
  };
  const multipart = await buildOutboundMultipartContent(
    body,
    provider,
    projectProviderConfig(project),
    outboundOptions,
  );
  const contentMultipart = await buildOutboundMultipartContent(
    replyIntro,
    provider,
    projectProviderConfig(project),
    outboundOptions,
  );
  const styled = applyEmailStyleToHtml(project, {
    contentMarkdown: replyIntro,
    contentHtml: contentMultipart.html,
    quoted,
    fallbackHtml: multipart.html,
  });
  const { inReplyTo, references } = threadingForParent(
    parent.messageId,
    parent.references,
  );
  const cc = outboundCommentCc(project, thread.originalSenderEmail);
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
      bodyHtml: styled.html,
      attachments: [...styled.attachments, ...multipart.attachments],
      inReplyTo,
      references,
    },
    { projectId },
  );

  const [inserted] = await db
    .insert(emailMessages)
    .values({
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
    })
    .onConflictDoNothing({
      target: [emailMessages.projectId, emailMessages.externalNoteId],
    })
    .returning({ id: emailMessages.id });

  if (!inserted) {
    logger.debug(
      { projectId, noteId: event.noteId },
      "note already recorded, skipping duplicate outbound",
    );
    await advanceLastSeenNoteAt(thread.id, noteCreatedAt);
    return;
  }

  await advanceLastSeenNoteAt(thread.id, noteCreatedAt);

  await provider.addReaction(event.issueIid, event.noteId, "e-mail");

  logger.info(
    { threadId: thread.id, noteId: event.noteId, inReplyTo, cc },
    "sent outbound email",
  );

  recordProjectSyncEvent({
    projectId,
    service: "smtp",
    operation: "send-outbound-email",
    severity: "success",
    message: formatSendOutboundEmailSuccess({
      issueIid: thread.issueIid,
      recipientEmail: thread.originalSenderEmail,
      recipientName: thread.originalSenderName,
      authorName: authorDisplayName,
    }),
    metadata: {
      threadId: thread.id,
      issueIid: thread.issueIid,
      noteId: event.noteId,
      messageId,
    },
  });
}

export async function pollCommentsForProject(projectId: string): Promise<void> {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project || !project.isActive) return;

  const provider = createProjectProvider(project);

  const threads = await db.query.issueThreads.findMany({
    where: and(
      eq(issueThreads.projectId, projectId),
      isNull(issueThreads.issueMissingAt),
    ),
  });

  logger.info(
    { projectId, threadCount: threads.length },
    "polling issue comments",
  );

  let notesChecked = 0;
  let notesSkipped = 0;
  let notesProcessed = 0;
  let threadsIssueMissing = 0;

  logger.debug(
    {
      projectId,
      providerBotUserId: project.providerBotUserId,
      threadCount: threads.length,
    },
    "starting issue comment poll for project",
  );

  for (const thread of threads) {
    const since = thread.lastSeenNoteAt ?? thread.createdAt;

    let notes;
    try {
      notes = await provider.listCommentsSince(thread.issueIid, since);
    } catch (err) {
      if (isProviderRateLimitError(err)) throw err;
      logExternalError(project.provider, "list-comments", err, {
        projectId,
        threadId: thread.id,
        issueIid: thread.issueIid,
      });
      continue;
    }

    if (notes === null) {
      threadsIssueMissing++;
      await db
        .update(issueThreads)
        .set({ issueMissingAt: new Date(), updatedAt: new Date() })
        .where(eq(issueThreads.id, thread.id));
      logger.warn(
        {
          projectId,
          threadId: thread.id,
          issueIid: thread.issueIid,
          externalIssueId: thread.externalIssueId,
        },
        "gitlab issue deleted or inaccessible, archived thread",
      );
      continue;
    }

    notesChecked += notes.length;

    logger.debug(
      {
        projectId,
        threadId: thread.id,
        issueIid: thread.issueIid,
        externalIssueId: thread.externalIssueId,
        since,
        lastSeenNoteAt: thread.lastSeenNoteAt,
        threadCreatedAt: thread.createdAt,
        noteCount: notes.length,
      },
      "listed issue comments for thread",
    );

    for (const note of notes) {
      const skipReason = outboundSkipReason(
        project,
        note.body,
        note.authorId,
        note.internal,
        note.system,
      );

      if (skipReason) {
        notesSkipped++;
        logger.debug(
          {
            projectId,
            threadId: thread.id,
            issueIid: thread.issueIid,
            noteId: note.id,
            authorId: note.authorId,
            authorUsername: note.authorUsername,
            createdAt: note.createdAt,
            internal: note.internal,
            system: note.system,
            skipReason,
            bodyPreview: note.body.slice(0, 120),
          },
          "skipping note in comment poll",
        );
        await advanceLastSeenNoteAt(thread.id, note.createdAt);
        continue;
      }

      logger.debug(
        {
          projectId,
          threadId: thread.id,
          issueIid: thread.issueIid,
          noteId: note.id,
          authorId: note.authorId,
          authorUsername: note.authorUsername,
          createdAt: note.createdAt,
        },
        "processing note from comment poll",
      );

      const event: NormalizedWebhookEvent = {
        type: "note_created",
        issueExternalId: thread.externalIssueId,
        issueIid: thread.issueIid,
        noteId: note.id,
        noteBody: note.body,
        authorId: note.authorId,
        authorName: note.authorName,
        authorUsername: note.authorUsername,
        internal: note.internal,
        system: note.system,
        createdAt: note.createdAt,
      };

      await processOutboundComment(projectId, event);
      notesProcessed++;
    }
  }

  // Advance the poll watermark on completion (not at enqueue) so the interval is
  // measured from when work actually finished.
  await db
    .update(projects)
    .set({ lastCommentPollAt: new Date() })
    .where(eq(projects.id, projectId));

  logger.info(
    {
      projectId,
      threadCount: threads.length,
      notesChecked,
      notesSkipped,
      notesProcessed,
      threadsIssueMissing,
    },
    "comment poll finished",
  );
}

export async function ensureWebhookForProject(
  projectId: string,
): Promise<void> {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) return;

  const webhookBase =
    process.env.WEBHOOK_BASE_URL ??
    process.env.API_URL ??
    "http://localhost:3000";
  const webhookUrl = `${webhookBase.replace(/\/$/, "")}/webhooks/${project.provider}/${projectId}`;

  const provider = createProjectProvider(project, {
    webhookUrl,
    webhookSecret: project.webhookSecret,
  });

  await provider.ensureWebhook(
    projectProviderConfig(project, {
      webhookUrl,
      webhookSecret: project.webhookSecret,
    }),
  );

  logger.info({ projectId, webhookUrl }, "webhook ensured");
}
