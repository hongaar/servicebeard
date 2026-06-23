import { getDb } from "@serviceboard/db";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { register } from "../lib/metrics";

const healthRoutes = new Hono();

healthRoutes.get("/healthz", (c) => c.json({ status: "ok" }));

healthRoutes.get("/readyz", async (c) => {
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    return c.json({ status: "ready" });
  } catch {
    return c.json({ status: "not ready" }, 503);
  }
});

healthRoutes.get("/metrics", async (c) => {
  const metrics = await register.metrics();
  return c.text(metrics, 200, {
    "Content-Type": register.contentType,
  });
});

export { healthRoutes };
