import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb, projects } from "@serviceboard/db";
import { createProvider } from "@serviceboard/providers";
import { getBoss, QUEUE_NAMES } from "../lib/queue";
import { syncEventsTotal } from "../lib/metrics";
import { logger } from "../lib/logger";

const webhookRoutes = new Hono();

webhookRoutes.post("/gitlab/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project || !project.isActive || !project.webhookEnabled) {
    return c.json({ error: "Not found" }, 404);
  }

  const body = await c.req.text();
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const provider = createProvider(project.provider, {
    baseUrl: project.providerBaseUrl,
    projectId: project.providerProjectId,
    token: "",
  });

  if (!provider.verifyWebhook(headers, body, project.webhookSecret)) {
    logger.warn({ projectId }, "webhook verification failed");
    return c.json({ error: "Unauthorized" }, 401);
  }

  const payload = JSON.parse(body);
  const event = provider.parseWebhook(payload);

  if (!event) {
    return c.json({ ok: true, skipped: true });
  }

  const boss = await getBoss();
  await boss.send(QUEUE_NAMES.SEND_EMAIL, {
    projectId,
    source: "webhook",
    event,
  });

  syncEventsTotal.inc({ direction: "outbound", status: "queued" });

  return c.json({ ok: true });
});

export { webhookRoutes };
