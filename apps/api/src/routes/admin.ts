import {
  dismissStatusEventById,
  listAdminProjects,
  listAdminStatusEvents,
  listAdminTeams,
  listAuditLogEntries,
} from "@servicebeard/db";
import { Hono } from "hono";
import { z } from "zod";
import { getLastAdminStatus, runAdminStatusChecks } from "../lib/admin-status";
import { requirePlatformAdmin } from "../middleware/admin";
import type { AppVariables } from "../middleware/auth";

export const adminRoutes = new Hono<{ Variables: AppVariables }>();

const overviewQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

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

adminRoutes.get("/teams", async (c) => {
  requirePlatformAdmin(c);
  const query = overviewQuerySchema.parse({
    search: c.req.query("search"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });

  const result = await listAdminTeams(query);
  return c.json({
    teams: result.teams.map((team) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      memberCount: team.memberCount,
      projectCount: team.projectCount,
      createdAt: team.createdAt.toISOString(),
    })),
    total: result.total,
  });
});

adminRoutes.get("/projects", async (c) => {
  requirePlatformAdmin(c);
  const query = overviewQuerySchema.parse({
    search: c.req.query("search"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });

  const result = await listAdminProjects(query);
  return c.json({
    projects: result.projects.map((project) => ({
      id: project.id,
      name: project.name,
      teamId: project.teamId,
      teamName: project.teamName,
      isActive: project.isActive,
      ruleCount: project.ruleCount,
      conversationCount: project.conversationCount,
      statusEvents: project.statusEvents,
      createdAt: project.createdAt.toISOString(),
    })),
    total: result.total,
  });
});

adminRoutes.get("/status-events", async (c) => {
  requirePlatformAdmin(c);
  const query = overviewQuerySchema.parse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });

  const result = await listAdminStatusEvents(query);
  return c.json({
    events: result.events.map((event) => ({
      id: event.id,
      projectId: event.projectId,
      projectName: event.projectName,
      teamId: event.teamId,
      teamName: event.teamName,
      category: event.category,
      severity: event.severity,
      operation: event.operation,
      message: event.message,
      status: event.status,
      responseBody: event.responseBody,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
      dismissedAt: null,
    })),
    total: result.total,
  });
});

adminRoutes.post("/status-events/:eventId/dismiss", async (c) => {
  requirePlatformAdmin(c);
  const eventId = c.req.param("eventId");
  const dismissed = await dismissStatusEventById(eventId);
  if (!dismissed) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
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
