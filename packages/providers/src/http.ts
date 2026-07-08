import { resolveMonorepoPath } from "@servicebeard/shared/env";
import { existsSync, readFileSync } from "node:fs";
import { ProviderRateLimitError } from "./errors";
import { logProvider } from "./log";
import { resolveRateLimitAdapter } from "./rate-limit/adapters";
import {
  getBucketState,
  markBucketExhausted,
  proactiveWaitMs,
  updateBucketSnapshot,
} from "./rate-limit/bucket";
import type { RateLimitSnapshot } from "./rate-limit/types";
import type { ProviderConfig } from "./types";

function readGlobalCaBundle(): string | undefined {
  const path = process.env.TLS_CA_BUNDLE;
  if (!path) return undefined;
  const resolved = resolveMonorepoPath(path);
  if (!existsSync(resolved)) return undefined;
  return readFileSync(resolved, "utf8");
}

export function buildTlsOptions(
  config: ProviderConfig,
): Record<string, unknown> | undefined {
  const tls: Record<string, unknown> = {};

  if (config.tlsInsecure) {
    tls.rejectUnauthorized = false;
  }

  const caParts: string[] = [];
  const globalCa = readGlobalCaBundle();
  if (globalCa) caParts.push(globalCa);
  if (config.caCert?.trim()) caParts.push(config.caCert.trim());

  if (caParts.length > 0) {
    tls.ca = caParts.join("\n");
  }

  return Object.keys(tls).length > 0 ? tls : undefined;
}

const LOW_REMAINING_THRESHOLD = 10;

function responseWithBody(response: Response, body: string): Response {
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function logRateLimitSnapshot(
  bucketKey: string,
  provider: string,
  snapshot: RateLimitSnapshot,
): void {
  const context = {
    bucketKey,
    provider,
    remaining: snapshot.remaining,
    limit: snapshot.limit,
    resetAtMs: snapshot.resetAtMs,
    resetAt:
      snapshot.resetAtMs != null
        ? new Date(snapshot.resetAtMs).toISOString()
        : null,
  };

  if (
    snapshot.remaining != null &&
    snapshot.remaining <= LOW_REMAINING_THRESHOLD
  ) {
    logProvider("warn", "provider API rate limit quota low", context);
    return;
  }

  logProvider("debug", "provider API rate limit snapshot", context);
}

async function plainFetch(
  config: ProviderConfig,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const tls = buildTlsOptions(config);
  return fetch(url, tls ? { ...init, tls } : init);
}

export async function providerFetch(
  config: ProviderConfig,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const adapter = resolveRateLimitAdapter(config, url);
  if (!adapter) {
    return plainFetch(config, url, init);
  }

  const bucketKey = adapter.bucketKey(config, url);
  if (!bucketKey) {
    return plainFetch(config, url, init);
  }

  let lastSnapshot: RateLimitSnapshot = {
    remaining: null,
    limit: null,
    resetAtMs: null,
  };

  const proactiveWait = proactiveWaitMs(bucketKey);
  if (proactiveWait > 0) {
    const bucketState = getBucketState(bucketKey);
    throw new ProviderRateLimitError({
      bucketKey,
      retryAtMs: Date.now() + proactiveWait,
      snapshot: bucketState ?? lastSnapshot,
      provider: adapter.name,
    });
  }

  const response = await plainFetch(config, url, init);
  const snapshot = adapter.parseSnapshot(response.headers);
  if (snapshot) {
    lastSnapshot = snapshot;
    updateBucketSnapshot(bucketKey, snapshot);
    logRateLimitSnapshot(bucketKey, adapter.name, snapshot);
  }

  if (response.ok) {
    return response;
  }

  const body = await response.text();
  if (!adapter.isRateLimited(response.status, body, response.headers)) {
    return responseWithBody(response, body);
  }

  const waitMs = adapter.retryAfterMs(response.status, body, response.headers);
  const retryAtMs = Date.now() + waitMs;
  markBucketExhausted(bucketKey, retryAtMs, lastSnapshot);

  logProvider("warn", "provider API rate limit hit", {
    bucketKey,
    provider: adapter.name,
    status: response.status,
    waitMs,
    retryAt: new Date(retryAtMs).toISOString(),
    remaining: lastSnapshot.remaining,
    limit: lastSnapshot.limit,
  });

  throw new ProviderRateLimitError({
    bucketKey,
    retryAtMs,
    snapshot: lastSnapshot,
    provider: adapter.name,
  });
}
