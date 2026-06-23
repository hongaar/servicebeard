import { getDb, projects } from "@serviceboard/db";
import type { NormalizedWebhookEvent } from "@serviceboard/providers";
import { eq } from "drizzle-orm";
import PgBoss from "pg-boss";
import "./lib/env-loader";
import { logger } from "./lib/logger";
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

export async function startWorker(): Promise<PgBoss> {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgres://serviceboard:serviceboard@localhost:5432/serviceboard";

  const boss = new PgBoss(connectionString);
  await boss.start();

  await boss.createQueue(QUEUE_NAMES.IMAP_POLL);
  await boss.createQueue(QUEUE_NAMES.COMMENT_POLL);
  await boss.createQueue(QUEUE_NAMES.SEND_EMAIL);
  await boss.createQueue(QUEUE_NAMES.ENSURE_WEBHOOK);

  boss.work<{ projectId: string }>(QUEUE_NAMES.IMAP_POLL, async ([job]) => {
    await processImapPoll(job!.data.projectId);
  });

  boss.work<{ projectId: string }>(QUEUE_NAMES.COMMENT_POLL, async ([job]) => {
    await pollCommentsForProject(job!.data.projectId);
  });

  boss.work<{
    projectId: string;
    source: string;
    event: NormalizedWebhookEvent;
  }>(QUEUE_NAMES.SEND_EMAIL, async ([job]) => {
    await processOutboundComment(job!.data.projectId, job!.data.event);
  });

  boss.work<{ projectId: string }>(QUEUE_NAMES.ENSURE_WEBHOOK, async ([job]) => {
    await ensureWebhookForProject(job!.data.projectId);
  });

  await schedulePollJobs(boss);

  logger.info("Worker started");
  return boss;
}

async function schedulePollJobs(boss: PgBoss): Promise<void> {
  const db = getDb();
  const activeProjects = await db.query.projects.findMany({
    where: eq(projects.isActive, true),
  });

  for (const project of activeProjects) {
    await boss.schedule(
      QUEUE_NAMES.IMAP_POLL,
      `*/${Math.max(1, Math.floor(project.imapPollIntervalSeconds / 60))} * * * *`,
      { projectId: project.id },
      { tz: "UTC" },
    );

    await boss.schedule(
      QUEUE_NAMES.COMMENT_POLL,
      `*/${Math.max(1, Math.floor(project.commentPollIntervalSeconds / 60))} * * * *`,
      { projectId: project.id },
      { tz: "UTC" },
    );
  }

  logger.info({ count: activeProjects.length }, "scheduled poll jobs");
}

await startWorker();
