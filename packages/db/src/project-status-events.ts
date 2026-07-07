import type { ProjectStatusSeverity } from "@servicebeard/shared";
import { classifySyncError } from "@servicebeard/shared";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { getDb } from "./index";
import { projects, projectStatusEvents, teams } from "./schema";

const MAX_RESPONSE_BODY = 4000;
const MAX_EVENTS_PER_PROJECT = 200;
const DUPLICATE_EVENT_WINDOW_MS = 30 * 60 * 1000;

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

  const message = input.message.slice(0, 2000);
  const severity = input.severity ?? "error";
  const db = getDb();

  const shouldDedupe = severity === "error" || severity === "warning";

  if (shouldDedupe) {
    const duplicate = await db.query.projectStatusEvents.findFirst({
      where: and(
        eq(projectStatusEvents.projectId, input.projectId),
        eq(projectStatusEvents.operation, input.operation),
        eq(projectStatusEvents.message, message),
        isNull(projectStatusEvents.dismissedAt),
        gte(
          projectStatusEvents.createdAt,
          new Date(Date.now() - DUPLICATE_EVENT_WINDOW_MS),
        ),
      ),
      columns: { id: true },
    });
    if (duplicate) return;
  }

  await db.insert(projectStatusEvents).values({
    projectId: input.projectId,
    category,
    severity,
    operation: input.operation,
    message,
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
      await db
        .delete(projectStatusEvents)
        .where(eq(projectStatusEvents.id, row.id));
    }
  }
}

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

export async function dismissAllProjectStatusEvents(
  projectId: string,
): Promise<number> {
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

export type AdminStatusEvent = {
  id: string;
  projectId: string;
  projectName: string;
  teamId: string;
  teamName: string;
  category: string;
  severity: string;
  operation: string;
  message: string;
  status: number | null;
  responseBody: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export async function listAdminStatusEvents(input: {
  limit?: number;
  offset?: number;
}): Promise<{ events: AdminStatusEvent[]; total: number }> {
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;
  const db = getDb();

  const events = await db
    .select({
      id: projectStatusEvents.id,
      projectId: projectStatusEvents.projectId,
      projectName: projects.name,
      teamId: projects.teamId,
      teamName: teams.name,
      category: projectStatusEvents.category,
      severity: projectStatusEvents.severity,
      operation: projectStatusEvents.operation,
      message: projectStatusEvents.message,
      status: projectStatusEvents.status,
      responseBody: projectStatusEvents.responseBody,
      metadata: projectStatusEvents.metadata,
      createdAt: projectStatusEvents.createdAt,
    })
    .from(projectStatusEvents)
    .innerJoin(projects, eq(projectStatusEvents.projectId, projects.id))
    .innerJoin(teams, eq(projects.teamId, teams.id))
    .where(isNull(projectStatusEvents.dismissedAt))
    .orderBy(desc(projectStatusEvents.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectStatusEvents)
    .where(isNull(projectStatusEvents.dismissedAt));

  return { events, total: totalRow?.count ?? 0 };
}

export async function dismissStatusEventById(
  eventId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(projectStatusEvents)
    .set({ dismissedAt: new Date() })
    .where(
      and(
        eq(projectStatusEvents.id, eventId),
        isNull(projectStatusEvents.dismissedAt),
      ),
    )
    .returning({ id: projectStatusEvents.id });

  return rows.length > 0;
}
