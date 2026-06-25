import { getDb, projects } from "@servicebeard/db";
import { createProvider } from "@servicebeard/providers";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { logger } from "../lib/logger";
import { syncEventsTotal } from "../lib/metrics";
import { getBoss, QUEUE_NAMES } from "../lib/queue";

const webhookRoutes = new Hono();

async function handleProviderWebhook(c: Context, expectedProvider: string) {
  const projectId = c.req.param("projectId");
  if (!projectId) {
    return c.json({ error: "Not found" }, 404);
  }
  const db = getDb();

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (
    !project ||
    !project.isActive ||
    project.provider !== expectedProvider
  ) {
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
    logger.warn({ projectId, provider: expectedProvider }, "webhook verification failed");
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
}

webhookRoutes.post("/gitlab/:projectId", (c) => handleProviderWebhook(c, "gitlab"));
webhookRoutes.post("/github/:projectId", (c) => handleProviderWebhook(c, "github"));

export { webhookRoutes };
