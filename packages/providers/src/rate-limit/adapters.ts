import type { ProviderConfig } from "../types";
import { hashRateLimitCredential, normalizeProviderBaseUrl } from "./bucket";
import type { RateLimitAdapter, RateLimitSnapshot } from "./types";

const DEFAULT_RETRY_MS = 60_000;

function parseIntHeader(headers: Headers, ...names: string[]): number | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value == null) continue;
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseResetAtMs(headers: Headers, ...names: string[]): number | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value == null) continue;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) continue;
    if (parsed > 1_000_000_000_000) {
      return parsed;
    }
    return parsed * 1000;
  }
  return null;
}

function retryAfterFromHeaders(
  headers: Headers,
  resetHeaderNames: string[],
  fallbackMs = DEFAULT_RETRY_MS,
): number {
  const retryAfterSeconds = parseIntHeader(headers, "Retry-After");
  if (retryAfterSeconds != null && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000;
  }

  const resetAtMs = parseResetAtMs(headers, ...resetHeaderNames);
  if (resetAtMs != null) {
    return Math.max(0, resetAtMs - Date.now());
  }

  return fallbackMs;
}

function snapshotFromHeaders(
  remainingNames: string[],
  limitNames: string[],
  resetNames: string[],
  headers: Headers,
): RateLimitSnapshot | null {
  const remaining = parseIntHeader(headers, ...remainingNames);
  const limit = parseIntHeader(headers, ...limitNames);
  const resetAtMs = parseResetAtMs(headers, ...resetNames);

  if (remaining == null && limit == null && resetAtMs == null) {
    return null;
  }

  return { remaining, limit, resetAtMs };
}

function isLinearRateLimitedBody(body: string): boolean {
  if (!body.trim()) return false;
  try {
    const payload = JSON.parse(body) as {
      errors?: Array<{ extensions?: { code?: string } }>;
    };
    return (
      payload.errors?.some(
        (error) => error.extensions?.code === "RATELIMITED",
      ) ?? false
    );
  } catch {
    return false;
  }
}

const githubAdapter: RateLimitAdapter = {
  name: "github",
  bucketKey(config, url) {
    if (config.rateLimitBucketKey) return config.rateLimitBucketKey;

    const baseUrl = normalizeProviderBaseUrl(config.baseUrl);
    if (config.githubInstallationId) {
      return `github:${baseUrl}:install:${config.githubInstallationId}`;
    }
    if (!config.token) return null;

    if (
      url.includes("/app/installations/") ||
      url.endsWith("/app") ||
      url.includes("/app/")
    ) {
      return `github:${baseUrl}:app`;
    }

    return `github:${baseUrl}:token:${hashRateLimitCredential(config.token)}`;
  },
  parseSnapshot(headers) {
    return snapshotFromHeaders(
      ["X-RateLimit-Remaining", "x-ratelimit-remaining"],
      ["X-RateLimit-Limit", "x-ratelimit-limit"],
      ["X-RateLimit-Reset", "x-ratelimit-reset"],
      headers,
    );
  },
  isRateLimited(status, _body, headers) {
    if (status === 429) return true;
    if (status === 403 && headers.get("Retry-After")) return true;
    return false;
  },
  retryAfterMs(status, body, headers) {
    void status;
    void body;
    return retryAfterFromHeaders(headers, [
      "X-RateLimit-Reset",
      "x-ratelimit-reset",
    ]);
  },
};

const gitlabAdapter: RateLimitAdapter = {
  name: "gitlab",
  bucketKey(config) {
    if (config.rateLimitBucketKey) return config.rateLimitBucketKey;
    if (!config.token) return null;
    return `gitlab:${normalizeProviderBaseUrl(config.baseUrl)}:token:${hashRateLimitCredential(config.token)}`;
  },
  parseSnapshot(headers) {
    return snapshotFromHeaders(
      ["RateLimit-Remaining", "ratelimit-remaining"],
      ["RateLimit-Limit", "ratelimit-limit"],
      ["RateLimit-Reset", "ratelimit-reset"],
      headers,
    );
  },
  isRateLimited(status) {
    return status === 429;
  },
  retryAfterMs(_status, _body, headers) {
    return retryAfterFromHeaders(headers, [
      "RateLimit-Reset",
      "ratelimit-reset",
    ]);
  },
};

const linearAdapter: RateLimitAdapter = {
  name: "linear",
  bucketKey(config) {
    if (config.rateLimitBucketKey) return config.rateLimitBucketKey;
    if (!config.token) return null;
    return `linear:token:${hashRateLimitCredential(config.token)}`;
  },
  parseSnapshot(headers) {
    return snapshotFromHeaders(
      ["X-RateLimit-Requests-Remaining", "x-ratelimit-requests-remaining"],
      ["X-RateLimit-Requests-Limit", "x-ratelimit-requests-limit"],
      ["X-RateLimit-Requests-Reset", "x-ratelimit-requests-reset"],
      headers,
    );
  },
  isRateLimited(status, body) {
    if (status === 429) return true;
    if (isLinearRateLimitedBody(body)) return true;
    return false;
  },
  retryAfterMs(_status, _body, headers) {
    return retryAfterFromHeaders(headers, [
      "X-RateLimit-Requests-Reset",
      "x-ratelimit-requests-reset",
      "X-RateLimit-Endpoint-Requests-Reset",
      "x-ratelimit-endpoint-requests-reset",
    ]);
  },
};

function isGitHubApiUrl(url: string, baseUrl: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "api.github.com") return true;
  } catch {
    // fall through
  }
  const normalizedBase = normalizeProviderBaseUrl(baseUrl);
  return (
    url.startsWith(`${normalizedBase}/api/v3`) ||
    url.includes("/api/v3/") ||
    url.includes("/api/graphql")
  );
}

function isGitLabApiUrl(url: string, baseUrl: string): boolean {
  const normalizedBase = normalizeProviderBaseUrl(baseUrl);
  return (
    url.includes("/api/v4/") ||
    url.startsWith(`${normalizedBase}/api/v4`) ||
    url.endsWith("/api/v4")
  );
}

function isLinearApiUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "api.linear.app";
  } catch {
    return url.includes("api.linear.app");
  }
}

export function resolveRateLimitAdapter(
  config: ProviderConfig,
  url: string,
): RateLimitAdapter | null {
  if (isLinearApiUrl(url)) return linearAdapter;
  if (isGitLabApiUrl(url, config.baseUrl)) return gitlabAdapter;
  if (isGitHubApiUrl(url, config.baseUrl)) return githubAdapter;
  return null;
}

export const rateLimitAdapters = {
  github: githubAdapter,
  gitlab: gitlabAdapter,
  linear: linearAdapter,
} as const;
