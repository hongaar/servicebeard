import { classifySyncError } from "@servicebeard/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "./index";
import { projectSyncErrors } from "./schema";

const MAX_RESPONSE_BODY = 4000;
const MAX_ERRORS_PER_PROJECT = 200;

export interface RecordProjectSyncErrorInput {
  projectId: string;
  service: string;
  operation: string;
  message: string;
  status?: number;
  responseBody?: string;
  metadata?: Record<string, unknown>;
}

function sanitizeMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const { projectId: _projectId, ...rest } = metadata;
  return Object.keys(rest).length > 0 ? rest : null;
}

export async function recordProjectSyncError(
  input: RecordProjectSyncErrorInput,
): Promise<void> {
  const category = classifySyncError(input.service, input.operation);
  if (!category) return;

  const db = getDb();
  await db.insert(projectSyncErrors).values({
    projectId: input.projectId,
    category,
    operation: input.operation,
    message: input.message.slice(0, 2000),
    status: input.status ?? null,
    responseBody: input.responseBody?.slice(0, MAX_RESPONSE_BODY) ?? null,
    metadata: sanitizeMetadata(input.metadata),
  });

  const stale = await db.query.projectSyncErrors.findMany({
    where: eq(projectSyncErrors.projectId, input.projectId),
    orderBy: desc(projectSyncErrors.createdAt),
    columns: { id: true },
    offset: MAX_ERRORS_PER_PROJECT,
  });

  if (stale.length > 0) {
    for (const row of stale) {
      await db.delete(projectSyncErrors).where(eq(projectSyncErrors.id, row.id));
    }
  }
}

export async function listProjectSyncErrors(projectId: string, limit = 50) {
  const db = getDb();
  return db.query.projectSyncErrors.findMany({
    where: and(
      eq(projectSyncErrors.projectId, projectId),
      isNull(projectSyncErrors.dismissedAt),
    ),
    orderBy: desc(projectSyncErrors.createdAt),
    limit,
  });
}

export async function dismissProjectSyncError(
  projectId: string,
  errorId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(projectSyncErrors)
    .set({ dismissedAt: new Date() })
    .where(
      and(
        eq(projectSyncErrors.id, errorId),
        eq(projectSyncErrors.projectId, projectId),
        isNull(projectSyncErrors.dismissedAt),
      ),
    )
    .returning({ id: projectSyncErrors.id });

  return rows.length > 0;
}

export async function dismissAllProjectSyncErrors(projectId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .update(projectSyncErrors)
    .set({ dismissedAt: new Date() })
    .where(
      and(
        eq(projectSyncErrors.projectId, projectId),
        isNull(projectSyncErrors.dismissedAt),
      ),
    )
    .returning({ id: projectSyncErrors.id });

  return rows.length;
}
