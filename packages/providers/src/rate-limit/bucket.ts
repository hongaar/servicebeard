import { createHash } from "node:crypto";
import type { ProviderConfig } from "../types";
import type { RateLimitSnapshot } from "./types";

export function normalizeProviderBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

export function hashRateLimitCredential(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function rateLimitBucketKeyForProvider(
  provider: string,
  config: ProviderConfig,
): string | null {
  if (config.rateLimitBucketKey) {
    return config.rateLimitBucketKey;
  }

  const baseUrl = normalizeProviderBaseUrl(config.baseUrl);

  switch (provider) {
    case "github":
      if (config.githubInstallationId) {
        return `github:${baseUrl}:install:${config.githubInstallationId}`;
      }
      if (config.token) {
        return `github:${baseUrl}:token:${hashRateLimitCredential(config.token)}`;
      }
      return null;
    case "gitlab":
      if (!config.token) return null;
      return `gitlab:${baseUrl}:token:${hashRateLimitCredential(config.token)}`;
    case "linear":
      if (!config.token) return null;
      return `linear:token:${hashRateLimitCredential(config.token)}`;
    default:
      return null;
  }
}

interface BucketState extends RateLimitSnapshot {
  exhaustedUntilMs: number;
}

const buckets = new Map<string, BucketState>();

export function getBucketState(bucketKey: string): BucketState | undefined {
  return buckets.get(bucketKey);
}

export function updateBucketSnapshot(
  bucketKey: string,
  snapshot: RateLimitSnapshot,
): void {
  const current = buckets.get(bucketKey);
  buckets.set(bucketKey, {
    remaining: snapshot.remaining ?? current?.remaining ?? null,
    limit: snapshot.limit ?? current?.limit ?? null,
    resetAtMs: snapshot.resetAtMs ?? current?.resetAtMs ?? null,
    exhaustedUntilMs: current?.exhaustedUntilMs ?? 0,
  });
}

export function markBucketExhausted(
  bucketKey: string,
  untilMs: number,
  snapshot?: RateLimitSnapshot,
): void {
  const current = buckets.get(bucketKey);
  buckets.set(bucketKey, {
    remaining: snapshot?.remaining ?? 0,
    limit: snapshot?.limit ?? current?.limit ?? null,
    resetAtMs: snapshot?.resetAtMs ?? current?.resetAtMs ?? untilMs,
    exhaustedUntilMs: Math.max(current?.exhaustedUntilMs ?? 0, untilMs),
  });
}

export function proactiveWaitMs(bucketKey: string): number {
  const state = buckets.get(bucketKey);
  if (!state) return 0;

  const now = Date.now();
  if (state.exhaustedUntilMs > now) {
    return state.exhaustedUntilMs - now;
  }

  if (
    state.remaining === 0 &&
    state.resetAtMs != null &&
    state.resetAtMs > now
  ) {
    return state.resetAtMs - now;
  }

  return 0;
}

export function resetRateLimitBucketsForTests(): void {
  buckets.clear();
}
