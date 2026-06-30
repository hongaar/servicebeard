import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "./index";
import { auditLog, teams, users } from "./schema";

export type AuditLogEntryRecord = {
  id: string;
  teamId: string | null;
  userId: string | null;
  projectId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  userEmail: string | null;
  userName: string | null;
  teamName: string | null;
};

export async function insertAuditLogEntry(entry: {
  teamId?: string;
  userId?: string;
  projectId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  await db.insert(auditLog).values(entry);
}

export async function listAuditLogEntries(input: {
  search?: string;
  teamId?: string;
  action?: string;
  resourceType?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: AuditLogEntryRecord[]; total: number }> {
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;
  const db = getDb();

  const conditions = [];
  if (input.teamId) {
    conditions.push(eq(auditLog.teamId, input.teamId));
  }
  if (input.action) {
    conditions.push(eq(auditLog.action, input.action));
  }
  if (input.resourceType) {
    conditions.push(eq(auditLog.resourceType, input.resourceType));
  }

  const search = input.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(auditLog.action, pattern),
        ilike(auditLog.resourceType, pattern),
        ilike(auditLog.resourceId, pattern),
        ilike(users.email, pattern),
        ilike(users.name, pattern),
        ilike(teams.name, pattern),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: auditLog.id,
      teamId: auditLog.teamId,
      userId: auditLog.userId,
      projectId: auditLog.projectId,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      userEmail: users.email,
      userName: users.name,
      teamName: teams.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .leftJoin(teams, eq(auditLog.teamId, teams.id))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .leftJoin(teams, eq(auditLog.teamId, teams.id))
    .where(where);

  return {
    entries: rows.map((row) => ({
      ...row,
      metadata: row.metadata ?? null,
    })),
    total: totalRow?.count ?? 0,
  };
}
