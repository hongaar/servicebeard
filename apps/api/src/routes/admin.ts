import { Hono } from "hono";
import { getLastAdminStatus, runAdminStatusChecks } from "../lib/admin-status";
import type { AppVariables } from "../middleware/auth";
import { requirePlatformAdmin } from "../middleware/admin";

export const adminRoutes = new Hono<{ Variables: AppVariables }>();

adminRoutes.get("/status", (c) => {
  requirePlatformAdmin(c);
  return c.json({ status: getLastAdminStatus() });
});

adminRoutes.post("/status/run", async (c) => {
  requirePlatformAdmin(c);
  const status = await runAdminStatusChecks();
  return c.json(status);
});
