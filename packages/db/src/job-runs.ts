import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "./index";
import { jobRuns, projects, teams } from "./schema";

const MAX_STORED_JOB_RUNS = 5_000;

export type JobRunStatus =
  "running" | "completed" | "failed" | "deferred" | "skipped";

export type JobRunRecord = {
  id: string;
  jobType: string;
  projectId: string | null;
  projectName: string | null;
  teamId: string | null;
  teamName: string | null;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
  durationMs: number | null;
};

export async function startJobRun(input: {
  jobType: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(jobRuns)
    .values({
      jobType: input.jobType,
      projectId: input.projectId ?? null,
      status: "running",
      metadata: input.metadata ?? null,
    })
    .returning({ id: jobRuns.id });

  return row!.id;
}

export async function finishJobRun(
  runId: string,
  input: {
    status: Exclude<JobRunStatus, "running">;
    error?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const db = getDb();
  const existing = await db.query.jobRuns.findFirst({
    where: eq(jobRuns.id, runId),
    columns: { metadata: true },
  });

  const mergedMetadata =
    existing?.metadata || input.metadata
      ? { ...(existing?.metadata ?? {}), ...(input.metadata ?? {}) }
      : null;

  await db
    .update(jobRuns)
    .set({
      status: input.status,
      finishedAt: new Date(),
      error: input.error?.slice(0, 2000) ?? null,
      metadata: mergedMetadata,
    })
    .where(eq(jobRuns.id, runId));

  await pruneJobRunsIfNeeded();
}

async function pruneJobRunsIfNeeded(): Promise<void> {
  const db = getDb();
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobRuns);

  const excess = (countRow?.count ?? 0) - MAX_STORED_JOB_RUNS;
  if (excess <= 0) return;

  const toDelete = Math.min(excess, 500);
  const stale = await db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .orderBy(asc(jobRuns.startedAt))
    .limit(toDelete);

  for (const row of stale) {
    await db.delete(jobRuns).where(eq(jobRuns.id, row.id));
  }
}

export async function listJobRuns(input: {
  search?: string;
  jobType?: string;
  status?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ runs: JobRunRecord[]; total: number }> {
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;
  const db = getDb();

  const conditions = [];
  if (input.jobType) {
    conditions.push(eq(jobRuns.jobType, input.jobType));
  }
  if (input.status) {
    conditions.push(eq(jobRuns.status, input.status));
  }
  if (input.projectId) {
    conditions.push(eq(jobRuns.projectId, input.projectId));
  }

  const search = input.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(jobRuns.jobType, pattern),
        ilike(jobRuns.error, pattern),
        ilike(projects.name, pattern),
        ilike(teams.name, pattern),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: jobRuns.id,
      jobType: jobRuns.jobType,
      projectId: jobRuns.projectId,
      projectName: projects.name,
      teamId: projects.teamId,
      teamName: teams.name,
      status: jobRuns.status,
      startedAt: jobRuns.startedAt,
      finishedAt: jobRuns.finishedAt,
      error: jobRuns.error,
      metadata: jobRuns.metadata,
    })
    .from(jobRuns)
    .leftJoin(projects, eq(jobRuns.projectId, projects.id))
    .leftJoin(teams, eq(projects.teamId, teams.id))
    .where(where)
    .orderBy(desc(jobRuns.startedAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobRuns)
    .leftJoin(projects, eq(jobRuns.projectId, projects.id))
    .leftJoin(teams, eq(projects.teamId, teams.id))
    .where(where);

  return {
    runs: rows.map((row) => ({
      id: row.id,
      jobType: row.jobType,
      projectId: row.projectId,
      projectName: row.projectName,
      teamId: row.teamId,
      teamName: row.teamName,
      status: row.status,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      error: row.error,
      metadata: row.metadata ?? null,
      durationMs:
        row.finishedAt && row.startedAt
          ? row.finishedAt.getTime() - row.startedAt.getTime()
          : null,
    })),
    total: totalRow?.count ?? 0,
  };
}
