import { listAuditLogEntries } from "@servicebeard/db";
import { Hono } from "hono";
import { z } from "zod";
import { getLastAdminStatus, runAdminStatusChecks } from "../lib/admin-status";
import { requirePlatformAdmin } from "../middleware/admin";
import type { AppVariables } from "../middleware/auth";

export const adminRoutes = new Hono<{ Variables: AppVariables }>();

const auditLogQuerySchema = z.object({
  search: z.string().optional(),
  teamId: z.string().uuid().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

adminRoutes.get("/status", (c) => {
  requirePlatformAdmin(c);
  return c.json({ status: getLastAdminStatus() });
});

adminRoutes.post("/status/run", async (c) => {
  requirePlatformAdmin(c);
  const status = await runAdminStatusChecks();
  return c.json(status);
});

adminRoutes.get("/audit-log", async (c) => {
  requirePlatformAdmin(c);
  const query = auditLogQuerySchema.parse({
    search: c.req.query("search"),
    teamId: c.req.query("teamId"),
    action: c.req.query("action"),
    resourceType: c.req.query("resourceType"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });

  const result = await listAuditLogEntries(query);
  return c.json({
    entries: result.entries.map((entry) => ({
      id: entry.id,
      teamId: entry.teamId,
      userId: entry.userId,
      projectId: entry.projectId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: entry.metadata,
      createdAt: entry.createdAt.toISOString(),
      userEmail: entry.userEmail,
      userName: entry.userName,
      teamName: entry.teamName,
    })),
    total: result.total,
  });
});
