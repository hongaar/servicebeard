import { getDb, projects } from "@servicebeard/db";
import type { NormalizedWebhookEvent } from "@servicebeard/providers";
import { setProviderLog } from "@servicebeard/providers";
import { getCommentPollIntervalSeconds, getImapPollIntervalSeconds } from "@servicebeard/shared";
import { getEntitlements } from "@servicebeard/shared/entitlements";
import { eq } from "drizzle-orm";
import PgBoss from "pg-boss";
import { loadWorkerExtensions } from "./extensions";
import "./lib/env-loader";
import { logExternalError } from "./lib/external-error";
import { logger } from "./lib/logger";
import { runExclusive } from "./lib/run-guard";
import { processImapPoll } from "./services/inbound";
import {
    ensureWebhookForProject,
    pollCommentsForProject,
    processOutboundComment,
} from "./services/outbound";

export const QUEUE_NAMES = {
  IMAP_POLL: "imap-poll",
  PROCESS_MESSAGE: "process-message",
  COMMENT_POLL: "comment-poll",
  SEND_EMAIL: "send-email",
  ENSURE_WEBHOOK: "ensure-webhook",
} as const;

/** pg-boss allows one cron schedule per queue name, so we tick every minute and honor per-project intervals in the worker. */
const POLL_TICK_CRON = "* * * * *";

const globalWorker = globalThis as typeof globalThis & {
  __servicebeardWorkerBoss?: PgBoss;
};

function isProjectPollDue(
  lastPollAt: Date | null,
  intervalSeconds: number,
): boolean {
  if (!lastPollAt) return true;
  return Date.now() - lastPollAt.getTime() >= intervalSeconds * 1000;
}

async function runImapPollsForDueProjects(): Promise<void> {
  const db = getDb();
  const imapPollIntervalSeconds = getImapPollIntervalSeconds();
  const activeProjects = await db.query.projects.findMany({
    where: eq(projects.isActive, true),
  });

  let polled = 0;
  let skippedNotDue = 0;

  for (const project of activeProjects) {
    const operational = await getEntitlements().isTeamOperational?.(project.teamId);
    if (operational === false) {
      skippedNotDue++;
      continue;
    }

    const teamIntervalResult = getEntitlements().getImapPollIntervalSeconds?.(project.teamId);
    const teamInterval =
      teamIntervalResult instanceof Promise ? await teamIntervalResult : teamIntervalResult;
    const intervalSeconds = teamInterval ?? imapPollIntervalSeconds;
    if (!isProjectPollDue(project.lastImapPollAt, intervalSeconds)) {
      skippedNotDue++;
      logger.debug(
        {
          projectId: project.id,
          lastImapPollAt: project.lastImapPollAt,
          intervalSeconds,
        },
        "imap poll not due yet",
      );
      continue;
    }

    const claimTime = new Date();
    await db
      .update(projects)
      .set({ lastImapPollAt: claimTime })
      .where(eq(projects.id, project.id));

    try {
      await processImapPoll(project.id);
      polled++;
    } catch (err) {
      logExternalError("worker", "imap-poll-project", err, { projectId: project.id });
    }
  }

  logger.info(
    { activeProjects: activeProjects.length, polled, skippedNotDue },
    "imap poll tick",
  );
}

async function runCommentPollsForDueProjects(): Promise<void> {
  const db = getDb();
  const commentPollIntervalSeconds = getCommentPollIntervalSeconds();
  const activeProjects = await db.query.projects.findMany({
    where: eq(projects.isActive, true),
  });

  let polled = 0;
  let skippedNotDue = 0;

  for (const project of activeProjects) {
    const operational = await getEntitlements().isTeamOperational?.(project.teamId);
    if (operational === false) {
      skippedNotDue++;
      continue;
    }

    const teamIntervalResult = getEntitlements().getImapPollIntervalSeconds?.(project.teamId);
    const teamInterval =
      teamIntervalResult instanceof Promise ? await teamIntervalResult : teamIntervalResult;
    const intervalSeconds = teamInterval ?? commentPollIntervalSeconds;
    if (!isProjectPollDue(project.lastCommentPollAt, intervalSeconds)) {
      skippedNotDue++;
      logger.debug(
        {
          projectId: project.id,
          lastCommentPollAt: project.lastCommentPollAt,
          intervalSeconds,
        },
        "comment poll not due yet",
      );
      continue;
    }

    const claimTime = new Date();
    await db
      .update(projects)
      .set({ lastCommentPollAt: claimTime })
      .where(eq(projects.id, project.id));

    try {
      await pollCommentsForProject(project.id);
      polled++;
    } catch (err) {
      logExternalError("worker", "comment-poll-project", err, { projectId: project.id });
    }
  }

  if (polled > 0 || skippedNotDue === 0) {
    logger.info(
      { activeProjects: activeProjects.length, polled, skippedNotDue },
      "comment poll tick",
    );
  } else {
    logger.debug(
      { activeProjects: activeProjects.length, polled, skippedNotDue },
      "comment poll tick skipped, not due yet",
    );
  }
}

async function stopExistingWorker(): Promise<void> {
  const existing = globalWorker.__servicebeardWorkerBoss;
  if (!existing) return;

  logger.info("stopping previous worker instance");
  try {
    await existing.stop({ graceful: true, timeout: 10_000 });
  } catch (err) {
    logger.warn({ err }, "failed to stop previous worker instance");
  } finally {
    globalWorker.__servicebeardWorkerBoss = undefined;
  }
}

export async function startWorker(): Promise<PgBoss> {
  await stopExistingWorker();

  setProviderLog((level, message, context) => {
    logger[level](context ?? {}, message);
  });

  const connectionString =
    process.env.DATABASE_URL ??
    "postgres://servicebeard:servicebeard@localhost:5432/servicebeard";

  const boss = new PgBoss(connectionString);
  await boss.start();

  await boss.createQueue(QUEUE_NAMES.IMAP_POLL, {
    name: QUEUE_NAMES.IMAP_POLL,
    policy: "singleton",
  });
  await boss.createQueue(QUEUE_NAMES.COMMENT_POLL, {
    name: QUEUE_NAMES.COMMENT_POLL,
    policy: "singleton",
  });
  await boss.createQueue(QUEUE_NAMES.SEND_EMAIL);
  await boss.createQueue(QUEUE_NAMES.ENSURE_WEBHOOK);

  await boss.purgeQueue(QUEUE_NAMES.IMAP_POLL);
  await boss.purgeQueue(QUEUE_NAMES.COMMENT_POLL);
  logger.info("cleared imap and comment poll queue backlogs");

  boss.work(QUEUE_NAMES.IMAP_POLL, { batchSize: 1 }, async () => {
    try {
      await runExclusive("imap-poll", runImapPollsForDueProjects);
    } catch (err) {
      logExternalError("pg-boss", "imap-poll", err);
      throw err;
    }
  });

  boss.work(QUEUE_NAMES.COMMENT_POLL, { batchSize: 1 }, async () => {
    try {
      await runExclusive("comment-poll", runCommentPollsForDueProjects);
    } catch (err) {
      logExternalError("pg-boss", "comment-poll", err);
      throw err;
    }
  });

  boss.work<{
    projectId: string;
    source: string;
    event: NormalizedWebhookEvent;
  }>(QUEUE_NAMES.SEND_EMAIL, { batchSize: 1 }, async ([job]) => {
    try {
      await runExclusive(
        `send-email:${job!.data.event.noteId}`,
        async () => processOutboundComment(job!.data.projectId, job!.data.event),
      );
    } catch (err) {
      logExternalError("pg-boss", "send-email", err, {
        projectId: job!.data.projectId,
        noteId: job!.data.event.noteId,
      });
      throw err;
    }
  });

  boss.work<{ projectId: string }>(
    QUEUE_NAMES.ENSURE_WEBHOOK,
    { batchSize: 1 },
    async ([job]) => {
      try {
        await ensureWebhookForProject(job!.data.projectId);
      } catch (err) {
        logExternalError("pg-boss", "ensure-webhook", err, {
          projectId: job!.data.projectId,
        });
      }
    },
  );

  await schedulePollJobs(boss);
  await loadWorkerExtensions({ boss });

  globalWorker.__servicebeardWorkerBoss = boss;

  logger.info("Worker started");
  return boss;
}

async function schedulePollJobs(boss: PgBoss): Promise<void> {
  await boss.schedule(QUEUE_NAMES.IMAP_POLL, POLL_TICK_CRON, {}, { tz: "UTC" });
  await boss.schedule(
    QUEUE_NAMES.COMMENT_POLL,
    POLL_TICK_CRON,
    {},
    { tz: "UTC" },
  );

  logger.info(
    { cron: POLL_TICK_CRON },
    "scheduled imap and comment poll jobs",
  );
}

async function shutdown(): Promise<void> {
  await stopExistingWorker();
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

await startWorker();
