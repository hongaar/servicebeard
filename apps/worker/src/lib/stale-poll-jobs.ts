import { getDb } from "@servicebeard/db";
import { sql } from "drizzle-orm";
import type PgBoss from "pg-boss";
import { logger } from "./logger";

const PROJECT_POLL_QUEUES = [
  "imap-poll-project",
  "comment-poll-project",
] as const;

/** Fail orphaned active project poll jobs after restart; expire() alone misses in-flight handlers. */
export async function clearStaleProjectPollJobs(boss: PgBoss): Promise<void> {
  await boss.expire();

  const db = getDb();
  const result = await db.execute(sql`
    UPDATE pgboss.job
    SET
      state = 'failed',
      completed_on = now(),
      output = '{"value":{"message":"orphaned active poll job cleared on worker start"}}'::jsonb
    WHERE state = 'active'
      AND name IN ('imap-poll-project', 'comment-poll-project')
  `);

  const cleared = Number((result as { rowCount?: number }).rowCount ?? 0);
  if (cleared > 0) {
    logger.info({ cleared }, "cleared orphaned active project poll jobs");
  }
}

export { PROJECT_POLL_QUEUES };
