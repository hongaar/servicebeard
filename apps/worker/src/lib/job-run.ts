import {
  finishJobRun,
  getDb,
  projects,
  startJobRun,
  teams,
  type JobRunStatus,
} from "@servicebeard/db";
import { eq } from "drizzle-orm";

export type JobRunContext = {
  runId: string;
  finish: (input: {
    status: Exclude<JobRunStatus, "running">;
    error?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
};

export type PollTickSummary = {
  activeProjects: number;
  enqueued: number;
  skippedNotDue: number;
  skippedActive: number;
  skippedErrors: number;
};

export type JobRunTrace = {
  current: Record<string, unknown>;
};

export function createJobRunTrace(): JobRunTrace {
  return { current: { scope: "platform" } };
}

export async function beginJobRun(input: {
  jobType: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}): Promise<JobRunContext> {
  const runId = await startJobRun(input);
  return {
    runId,
    finish: (finishInput) => finishJobRun(runId, finishInput),
  };
}

export async function loadProjectJobRunContext(
  projectId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: {
      id: true,
      name: true,
      slug: true,
      teamId: true,
      provider: true,
    },
    with: {
      team: {
        columns: { id: true, name: true, slug: true },
      },
    },
  });

  if (!project) {
    return { scope: "project", projectId, projectMissing: true };
  }

  return {
    scope: "project",
    projectId: project.id,
    projectName: project.name,
    projectSlug: project.slug,
    teamId: project.teamId,
    teamName: project.team.name,
    teamSlug: project.team.slug,
    provider: project.provider,
  };
}

export function jobRunError(err: unknown): string {
  return serializeJobRunError(err).error;
}

export function serializeJobRunError(
  err: unknown,
  context?: Record<string, unknown>,
): { error: string; metadata: Record<string, unknown> } {
  const metadata: Record<string, unknown> = {
    ...(context ?? {}),
  };

  if (err instanceof Error) {
    metadata.errorName = err.name;
    if ("code" in err && err.code != null && err.code !== "") {
      metadata.errorCode = err.code;
    }
    if (err.cause != null) {
      metadata.cause =
        err.cause instanceof Error ? err.cause.message : String(err.cause);
    }
    if (err.stack) {
      metadata.stack = err.stack.split("\n").slice(0, 6).join("\n");
    }
    return { error: err.message, metadata };
  }

  return { error: String(err), metadata };
}

export async function enrichJobRunContext(
  context?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!context) return {};
  if (context.teamName || typeof context.teamId !== "string") {
    return context;
  }

  const db = getDb();
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, context.teamId),
    columns: { name: true, slug: true },
  });

  if (!team) return context;
  return {
    ...context,
    teamName: team.name,
    teamSlug: team.slug,
  };
}

export async function finishJobRunWithError(
  run: JobRunContext,
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const enriched = await enrichJobRunContext(context);
  const { error, metadata } = serializeJobRunError(err, enriched);
  await run.finish({ status: "failed", error, metadata });
}
