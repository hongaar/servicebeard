import type { RateLimitSnapshot } from "./rate-limit/types";

export class ProviderApiError extends Error {
  readonly status: number;
  readonly responseBody?: string;

  constructor(
    status: number,
    message: string,
    name = "ProviderApiError",
    responseBody?: string,
  ) {
    super(message);
    this.name = name;
    this.status = status;
    this.responseBody = responseBody;
  }
}

export class ProviderRateLimitError extends ProviderApiError {
  readonly bucketKey: string;
  readonly retryAtMs: number;
  readonly snapshot: RateLimitSnapshot;
  readonly provider: string;

  constructor(options: {
    bucketKey: string;
    retryAtMs: number;
    snapshot: RateLimitSnapshot;
    provider: string;
    message?: string;
  }) {
    const retryAt = new Date(options.retryAtMs).toISOString();
    super(
      429,
      options.message ??
        `Provider rate limit exceeded (${options.provider}, bucket ${options.bucketKey}); retry after ${retryAt}`,
      "ProviderRateLimitError",
    );
    this.bucketKey = options.bucketKey;
    this.retryAtMs = options.retryAtMs;
    this.snapshot = options.snapshot;
    this.provider = options.provider;
  }
}

export function isProviderRateLimitError(
  err: unknown,
): err is ProviderRateLimitError {
  return err instanceof ProviderRateLimitError;
}

export function providerErrorDetails(err: unknown): {
  status: number;
  message: string;
  name: string;
  responseBody?: string;
  rateLimit?: {
    bucketKey: string;
    retryAtMs: number;
    provider: string;
    remaining: number | null;
    limit: number | null;
    resetAtMs: number | null;
  };
} | null {
  if (err instanceof ProviderRateLimitError) {
    return {
      status: err.status,
      message: err.message,
      name: err.name,
      responseBody: err.responseBody,
      rateLimit: {
        bucketKey: err.bucketKey,
        retryAtMs: err.retryAtMs,
        provider: err.provider,
        remaining: err.snapshot.remaining,
        limit: err.snapshot.limit,
        resetAtMs: err.snapshot.resetAtMs,
      },
    };
  }

  if (!(err instanceof ProviderApiError)) return null;
  return {
    status: err.status,
    message: err.message,
    name: err.name,
    responseBody: err.responseBody,
  };
}
