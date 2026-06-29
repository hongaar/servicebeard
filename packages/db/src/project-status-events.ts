import type { ProjectStatusSeverity } from "@servicebeard/shared";
import { classifySyncError } from "@servicebeard/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "./index";
import { projectStatusEvents } from "./schema";

const MAX_RESPONSE_BODY = 4000;
const MAX_EVENTS_PER_PROJECT = 200;

export interface RecordProjectStatusEventInput {
  projectId: string;
  service: string;
  operation: string;
  message: string;
  status?: number;
  responseBody?: string;
  metadata?: Record<string, unknown>;
  severity?: ProjectStatusSeverity;
}

function sanitizeMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const { projectId: _projectId, ...rest } = metadata;
  return Object.keys(rest).length > 0 ? rest : null;
}

export async function recordProjectStatusEvent(
  input: RecordProjectStatusEventInput,
): Promise<void> {
  const category = classifySyncError(input.service, input.operation);
  if (!category) return;

  const db = getDb();
  await db.insert(projectStatusEvents).values({
    projectId: input.projectId,
    category,
    severity: input.severity ?? "error",
    operation: input.operation,
    message: input.message.slice(0, 2000),
    status: input.status ?? null,
    responseBody: input.responseBody?.slice(0, MAX_RESPONSE_BODY) ?? null,
    metadata: sanitizeMetadata(input.metadata),
  });

  const stale = await db.query.projectStatusEvents.findMany({
    where: eq(projectStatusEvents.projectId, input.projectId),
    orderBy: desc(projectStatusEvents.createdAt),
    columns: { id: true },
    offset: MAX_EVENTS_PER_PROJECT,
  });

  if (stale.length > 0) {
    for (const row of stale) {
      await db.delete(projectStatusEvents).where(eq(projectStatusEvents.id, row.id));
    }
  }
}

/** @deprecated Use recordProjectStatusEvent */
export const recordProjectSyncError = recordProjectStatusEvent;

export async function listProjectStatusEvents(projectId: string, limit = 50) {
  const db = getDb();
  return db.query.projectStatusEvents.findMany({
    where: and(
      eq(projectStatusEvents.projectId, projectId),
      isNull(projectStatusEvents.dismissedAt),
    ),
    orderBy: desc(projectStatusEvents.createdAt),
    limit,
  });
}

/** @deprecated Use listProjectStatusEvents */
export const listProjectSyncErrors = listProjectStatusEvents;

export async function dismissProjectStatusEvent(
  projectId: string,
  eventId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(projectStatusEvents)
    .set({ dismissedAt: new Date() })
    .where(
      and(
        eq(projectStatusEvents.id, eventId),
        eq(projectStatusEvents.projectId, projectId),
        isNull(projectStatusEvents.dismissedAt),
      ),
    )
    .returning({ id: projectStatusEvents.id });

  return rows.length > 0;
}

/** @deprecated Use dismissProjectStatusEvent */
export const dismissProjectSyncError = dismissProjectStatusEvent;

export async function dismissAllProjectStatusEvents(projectId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .update(projectStatusEvents)
    .set({ dismissedAt: new Date() })
    .where(
      and(
        eq(projectStatusEvents.projectId, projectId),
        isNull(projectStatusEvents.dismissedAt),
      ),
    )
    .returning({ id: projectStatusEvents.id });

  return rows.length;
}

/** @deprecated Use dismissAllProjectStatusEvents */
export const dismissAllProjectSyncErrors = dismissAllProjectStatusEvents;
