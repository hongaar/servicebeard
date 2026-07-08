import type { projects } from "@servicebeard/db";
import {
  isProviderRateLimitError,
  type ProviderRateLimitError,
  rateLimitBucketKeyForProvider,
} from "@servicebeard/providers";
import type PgBoss from "pg-boss";
import { projectProviderConfig } from "../services/provider";
import { logger } from "./logger";

type ProjectRow = typeof projects.$inferSelect;

export function projectRateLimitBucketKey(project: ProjectRow): string | null {
  return rateLimitBucketKeyForProvider(
    project.provider,
    projectProviderConfig(project),
  );
}

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

export function shouldSkipProjectForRateLimit(
  project: ProjectRow,
  exhaustedBuckets: ReadonlySet<string>,
): boolean {
  const bucketKey = projectRateLimitBucketKey(project);
  return bucketKey != null && exhaustedBuckets.has(bucketKey);
}

export function markRateLimitBucketExhausted(
  err: unknown,
  exhaustedBuckets: Set<string>,
): err is ProviderRateLimitError {
  if (!isProviderRateLimitError(err)) return false;
  exhaustedBuckets.add(err.bucketKey);
  return true;
}
