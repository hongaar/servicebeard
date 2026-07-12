import { getDb, sql } from "@servicebeard/db";

type AdvisoryLockRow = {
  acquired: boolean;
};

export async function tryAcquireNoteLock(
  projectId: string,
  noteId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute<AdvisoryLockRow>(
    sql`SELECT pg_try_advisory_lock(hashtext(${projectId}), hashtext(${noteId})) AS acquired`,
  );
  return rows[0]?.acquired ?? false;
}

export async function releaseNoteLock(
  projectId: string,
  noteId: string,
): Promise<void> {
  const db = getDb();
  await db.execute(
    sql`SELECT pg_advisory_unlock(hashtext(${projectId}), hashtext(${noteId}))`,
  );
}
