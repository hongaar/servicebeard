import type { Context, Next } from "hono";
import { logger } from "../lib/logger";

const SKIP_PATHS = new Set(["/healthz", "/readyz", "/metrics"]);

export async function requestLogMiddleware(c: Context, next: Next) {
  const start = Date.now();
  await next();
  const path = c.req.path;

  if (SKIP_PATHS.has(path)) return;

  const status = c.res.status;
  const durationMs = Date.now() - start;
  const entry = {
    method: c.req.method,
    path,
    status,
    durationMs,
  };

  if (status >= 500) {
    logger.error(entry, "request failed");
  } else if (status >= 400) {
    logger.warn(entry, "request client error");
  } else {
    logger.info(entry, "request completed");
  }
}
