import { getDb, projects } from "@servicebeard/db";
import {
  isProviderRateLimitError,
  setProviderLog,
  type NormalizedWebhookEvent,
} from "@servicebeard/providers";
import {
  getCommentPollIntervalSeconds,
  getImapPollIntervalSeconds,
} from "@servicebeard/shared";
import { getEntitlements } from "@servicebeard/shared/entitlements";
import { eq } from "drizzle-orm";
import PgBoss from "pg-boss";
import { loadWorkerExtensions } from "./extensions";
import { initBugsink } from "./lib/bugsink";
import "./lib/env-loader";
import { logExternalError } from "./lib/external-error";
import {
  beginJobRun,
  createJobRunTrace,
  finishJobRunWithError,
  loadProjectJobRunContext,
  type JobRunTrace,
  type PollTickSummary,
} from "./lib/job-run";
import { logger } from "./lib/logger";
import { deferQueueJob } from "./lib/provider-rate-limit";
import { runExclusive } from "./lib/run-guard";
import {
  getCommentPollConcurrency,
  getImapPollConcurrency,
  getSendEmailConcurrency,
} from "./lib/worker-config";
import { processImapPoll } from "./services/inbound";
import {
  ensureWebhookForProject,
  pollCommentsForProject,
  processOutboundComment,
} from "./services/outbound";
import { closeAllTransporters } from "./services/smtp";

initBugsink();

export const QUEUE_NAMES = {
  IMAP_POLL: "imap-poll",
  IMAP_POLL_PROJECT: "imap-poll-project",
  COMMENT_POLL: "comment-poll",
  COMMENT_POLL_PROJECT: "comment-poll-project",
  SEND_EMAIL: "send-email",
  ENSURE_WEBHOOK: "ensure-webhook",
} as const;

/** pg-boss allows one cron schedule per queue name, so we tick every minute and honor per-project intervals in the worker. */
const POLL_TICK_CRON = "* * * * *";
/** Poll ticks should finish quickly; short expiry recovers after watch-mode restarts leave active jobs behind. */
const POLL_JOB_EXPIRE_SECONDS = 90;

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

async function scheduleImapPollsForDueProjects(
  boss: PgBoss,
  trace: JobRunTrace,
): Promise<PollTickSummary> {
  trace.current = { scope: "platform", phase: "load-active-projects" };
  const db = getDb();
  const imapPollIntervalSeconds = getImapPollIntervalSeconds();
  const activeProjects = await db.query.projects.findMany({
    where: eq(projects.isActive, true),
  });

  let enqueued = 0;
  let skippedNotDue = 0;
  let skippedErrors = 0;

  for (const project of activeProjects) {
    trace.current = {
      scope: "platform",
      phase: "schedule-enqueue",
      projectId: project.id,
      projectName: project.name,
      teamId: project.teamId,
    };

    try {
      const operational = await getEntitlements().isTeamOperational?.(
        project.teamId,
      );
      if (operational === false) {
        skippedNotDue++;
        continue;
      }

      const teamIntervalResult = getEntitlements().getImapPollIntervalSeconds?.(
        project.teamId,
      );
      const teamInterval =
        teamIntervalResult instanceof Promise
          ? await teamIntervalResult
          : teamIntervalResult;
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

      await boss.send(
        QUEUE_NAMES.IMAP_POLL_PROJECT,
        { projectId: project.id },
        { singletonKey: project.id },
      );
      enqueued++;
    } catch (err) {
      skippedErrors++;
      logger.warn(
        {
          err,
          projectId: project.id,
          projectName: project.name,
          teamId: project.teamId,
        },
        "failed to schedule imap poll for project",
      );
      logExternalError("worker", "imap-poll-schedule", err, {
        projectId: project.id,
      });
    }
  }

  logger.info(
    {
      activeProjects: activeProjects.length,
      enqueued,
      skippedNotDue,
      skippedErrors,
    },
    "imap poll tick",
  );

  return {
    activeProjects: activeProjects.length,
    enqueued,
    skippedNotDue,
    skippedErrors,
  };
}

async function scheduleCommentPollsForDueProjects(
  boss: PgBoss,
  trace: JobRunTrace,
): Promise<PollTickSummary> {
  trace.current = { scope: "platform", phase: "load-active-projects" };
  const db = getDb();
  const commentPollIntervalSeconds = getCommentPollIntervalSeconds();
  const activeProjects = await db.query.projects.findMany({
    where: eq(projects.isActive, true),
  });

  let enqueued = 0;
  let skippedNotDue = 0;
  let skippedErrors = 0;

  for (const project of activeProjects) {
    trace.current = {
      scope: "platform",
      phase: "schedule-enqueue",
      projectId: project.id,
      projectName: project.name,
      teamId: project.teamId,
    };

    try {
      const operational = await getEntitlements().isTeamOperational?.(
        project.teamId,
      );
      if (operational === false) {
        skippedNotDue++;
        continue;
      }

      const teamIntervalResult = getEntitlements().getImapPollIntervalSeconds?.(
        project.teamId,
      );
      const teamInterval =
        teamIntervalResult instanceof Promise
          ? await teamIntervalResult
          : teamIntervalResult;
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

      await boss.send(
        QUEUE_NAMES.COMMENT_POLL_PROJECT,
        { projectId: project.id },
        { singletonKey: project.id },
      );
      enqueued++;
    } catch (err) {
      skippedErrors++;
      logger.warn(
        {
          err,
          projectId: project.id,
          projectName: project.name,
          teamId: project.teamId,
        },
        "failed to schedule comment poll for project",
      );
      logExternalError("worker", "comment-poll-schedule", err, {
        projectId: project.id,
      });
    }
  }

  if (enqueued > 0 || skippedNotDue === 0 || skippedErrors > 0) {
    logger.info(
      {
        activeProjects: activeProjects.length,
        enqueued,
        skippedNotDue,
        skippedErrors,
      },
      "comment poll tick",
    );
  } else {
    logger.debug(
      { activeProjects: activeProjects.length, enqueued, skippedNotDue },
      "comment poll tick skipped, not due yet",
    );
  }

  return {
    activeProjects: activeProjects.length,
    enqueued,
    skippedNotDue,
    skippedErrors,
  };
}

function registerSendEmailWorkers(boss: PgBoss): void {
  const concurrency = getSendEmailConcurrency();

  const handler = async ([job]: PgBoss.Job<{
    projectId: string;
    source: string;
    event: NormalizedWebhookEvent;
  }>[]) => {
    const { projectId, event } = job!.data;
    const projectContext = await loadProjectJobRunContext(projectId);
    const run = await beginJobRun({
      jobType: QUEUE_NAMES.SEND_EMAIL,
      projectId,
      metadata: {
        ...projectContext,
        operation: "send-email",
        noteId: event.noteId,
        source: job!.data.source,
      },
    });
    try {
      const result = await runExclusive(
        `send-email:${event.noteId}`,
        async () => processOutboundComment(projectId, event),
      );
      if (result === undefined) {
        await run.finish({
          status: "skipped",
          metadata: { reason: "concurrent" },
        });
        return;
      }
      await run.finish({ status: "completed" });
    } catch (err) {
      if (isProviderRateLimitError(err)) {
        await deferQueueJob(
          boss,
          QUEUE_NAMES.SEND_EMAIL,
          job!.data,
          err,
          "send-email",
          {
            projectId,
            noteId: event.noteId,
          },
        );
        await run.finish({
          status: "deferred",
          metadata: {
            bucketKey: err.bucketKey,
            retryAt: new Date(err.retryAtMs).toISOString(),
          },
        });
        return;
      }
      await finishJobRunWithError(run, err, {
        ...projectContext,
        operation: "send-email",
        noteId: event.noteId,
      });
      logExternalError("worker", "send-email", err, {
        projectId,
        noteId: event.noteId,
      });
      throw err;
    }
  };

  for (let i = 0; i < concurrency; i++) {
    boss.work(QUEUE_NAMES.SEND_EMAIL, { batchSize: 1 }, handler);
  }
}

function registerImapPollProjectWorkers(boss: PgBoss): void {
  const concurrency = getImapPollConcurrency();

  const handler = async ([job]: PgBoss.Job<{ projectId: string }>[]) => {
    const { projectId } = job!.data;
    const projectContext = await loadProjectJobRunContext(projectId);
    const run = await beginJobRun({
      jobType: QUEUE_NAMES.IMAP_POLL_PROJECT,
      projectId,
      metadata: { ...projectContext, operation: "imap-poll" },
    });
    try {
      await processImapPoll(projectId);
      await run.finish({ status: "completed" });
    } catch (err) {
      if (isProviderRateLimitError(err)) {
        await deferQueueJob(
          boss,
          QUEUE_NAMES.IMAP_POLL_PROJECT,
          job!.data,
          err,
          "imap-poll-project",
          { projectId },
        );
        await run.finish({
          status: "deferred",
          metadata: {
            ...projectContext,
            operation: "imap-poll",
            bucketKey: err.bucketKey,
            retryAt: new Date(err.retryAtMs).toISOString(),
          },
        });
        return;
      }
      await finishJobRunWithError(run, err, {
        ...projectContext,
        operation: "imap-poll",
      });
      logExternalError("worker", "imap-poll-project", err, { projectId });
      throw err;
    }
  };

  for (let i = 0; i < concurrency; i++) {
    boss.work(QUEUE_NAMES.IMAP_POLL_PROJECT, { batchSize: 1 }, handler);
  }
}

function registerCommentPollProjectWorkers(boss: PgBoss): void {
  const concurrency = getCommentPollConcurrency();

  const handler = async ([job]: PgBoss.Job<{ projectId: string }>[]) => {
    const { projectId } = job!.data;
    const projectContext = await loadProjectJobRunContext(projectId);
    const run = await beginJobRun({
      jobType: QUEUE_NAMES.COMMENT_POLL_PROJECT,
      projectId,
      metadata: { ...projectContext, operation: "comment-poll" },
    });
    try {
      await pollCommentsForProject(projectId);
      await run.finish({ status: "completed" });
    } catch (err) {
      if (isProviderRateLimitError(err)) {
        await deferQueueJob(
          boss,
          QUEUE_NAMES.COMMENT_POLL_PROJECT,
          job!.data,
          err,
          "comment-poll-project",
          { projectId },
        );
        await run.finish({
          status: "deferred",
          metadata: {
            ...projectContext,
            operation: "comment-poll",
            bucketKey: err.bucketKey,
            retryAt: new Date(err.retryAtMs).toISOString(),
          },
        });
        return;
      }
      await finishJobRunWithError(run, err, {
        ...projectContext,
        operation: "comment-poll",
      });
      logExternalError("worker", "comment-poll-project", err, { projectId });
      throw err;
    }
  };

  for (let i = 0; i < concurrency; i++) {
    boss.work(QUEUE_NAMES.COMMENT_POLL_PROJECT, { batchSize: 1 }, handler);
  }
}

async function stopExistingWorker(): Promise<void> {
  const existing = globalWorker.__servicebeardWorkerBoss;
  if (!existing) return;

  logger.info("stopping previous worker instance");
  try {
    await closeAllTransporters();
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
    expireInSeconds: POLL_JOB_EXPIRE_SECONDS,
  });
  await boss.createQueue(QUEUE_NAMES.COMMENT_POLL, {
    name: QUEUE_NAMES.COMMENT_POLL,
    policy: "singleton",
    expireInSeconds: POLL_JOB_EXPIRE_SECONDS,
  });
  await boss.createQueue(QUEUE_NAMES.IMAP_POLL_PROJECT, {
    name: QUEUE_NAMES.IMAP_POLL_PROJECT,
    policy: "short",
  });
  await boss.createQueue(QUEUE_NAMES.COMMENT_POLL_PROJECT, {
    name: QUEUE_NAMES.COMMENT_POLL_PROJECT,
    policy: "short",
  });
  await boss.createQueue(QUEUE_NAMES.SEND_EMAIL);
  await boss.createQueue(QUEUE_NAMES.ENSURE_WEBHOOK);

  await boss.purgeQueue(QUEUE_NAMES.IMAP_POLL);
  await boss.purgeQueue(QUEUE_NAMES.COMMENT_POLL);
  await boss.expire();
  logger.info("cleared imap and comment poll queue backlogs");

  boss.work(QUEUE_NAMES.IMAP_POLL, { batchSize: 1 }, async () => {
    await runExclusive("imap-poll", async () => {
      const trace = createJobRunTrace();
      const run = await beginJobRun({
        jobType: QUEUE_NAMES.IMAP_POLL,
        metadata: { scope: "platform", operation: "imap-poll-tick" },
      });
      try {
        const summary = await scheduleImapPollsForDueProjects(boss, trace);
        await run.finish({ status: "completed", metadata: summary });
      } catch (err) {
        await finishJobRunWithError(run, err, trace.current);
        logExternalError("worker", "imap-poll-tick", err);
        throw err;
      }
    });
  });

  boss.work(QUEUE_NAMES.COMMENT_POLL, { batchSize: 1 }, async () => {
    await runExclusive("comment-poll", async () => {
      const trace = createJobRunTrace();
      const run = await beginJobRun({
        jobType: QUEUE_NAMES.COMMENT_POLL,
        metadata: { scope: "platform", operation: "comment-poll-tick" },
      });
      try {
        const summary = await scheduleCommentPollsForDueProjects(boss, trace);
        await run.finish({ status: "completed", metadata: summary });
      } catch (err) {
        await finishJobRunWithError(run, err, trace.current);
        logExternalError("worker", "comment-poll-tick", err);
        throw err;
      }
    });
  });

  registerSendEmailWorkers(boss);
  registerImapPollProjectWorkers(boss);
  registerCommentPollProjectWorkers(boss);

  boss.work<{ projectId: string }>(
    QUEUE_NAMES.ENSURE_WEBHOOK,
    { batchSize: 1 },
    async ([job]) => {
      const projectId = job!.data.projectId;
      const projectContext = await loadProjectJobRunContext(projectId);
      const run = await beginJobRun({
        jobType: QUEUE_NAMES.ENSURE_WEBHOOK,
        projectId,
        metadata: { ...projectContext, operation: "ensure-webhook" },
      });
      try {
        await ensureWebhookForProject(projectId);
        await run.finish({ status: "completed" });
      } catch (err) {
        await finishJobRunWithError(run, err, {
          ...projectContext,
          operation: "ensure-webhook",
        });
        logExternalError("worker", "ensure-webhook", err, { projectId });
      }
    },
  );

  await schedulePollJobs(boss);
  await loadWorkerExtensions({ boss });

  globalWorker.__servicebeardWorkerBoss = boss;

  logger.info(
    {
      sendEmailConcurrency: getSendEmailConcurrency(),
      imapPollConcurrency: getImapPollConcurrency(),
      commentPollConcurrency: getCommentPollConcurrency(),
    },
    "Worker started",
  );
  return boss;
}

async function schedulePollJobs(boss: PgBoss): Promise<void> {
  const pollScheduleOptions = {
    tz: "UTC" as const,
    expireInSeconds: POLL_JOB_EXPIRE_SECONDS,
  };
  await boss.schedule(
    QUEUE_NAMES.IMAP_POLL,
    POLL_TICK_CRON,
    {},
    pollScheduleOptions,
  );
  await boss.schedule(
    QUEUE_NAMES.COMMENT_POLL,
    POLL_TICK_CRON,
    {},
    pollScheduleOptions,
  );

  logger.info({ cron: POLL_TICK_CRON }, "scheduled imap and comment poll jobs");
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
