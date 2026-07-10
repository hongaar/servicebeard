import { type ProviderRateLimitError } from "@servicebeard/providers";
import type PgBoss from "pg-boss";
import { logger } from "./logger";

export function logProviderRateLimitDeferral(
  operation: string,
  err: ProviderRateLimitError,
  context?: Record<string, unknown>,
): void {
  logger.warn(
    {
      operation,
      bucketKey: err.bucketKey,
      provider: err.provider,
      retryAtMs: err.retryAtMs,
      retryAt: new Date(err.retryAtMs).toISOString(),
      remaining: err.snapshot.remaining,
      limit: err.snapshot.limit,
      resetAtMs: err.snapshot.resetAtMs,
      ...context,
    },
    "deferred work due to provider rate limit",
  );
}

export async function deferQueueJob<T extends Record<string, unknown>>(
  boss: PgBoss,
  queueName: string,
  data: T,
  err: ProviderRateLimitError,
  operation: string,
  context?: Record<string, unknown>,
): Promise<void> {
  logProviderRateLimitDeferral(operation, err, context);
  await boss.send(queueName, data, {
    startAfter: new Date(err.retryAtMs),
  });
}
