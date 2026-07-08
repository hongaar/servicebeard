export interface RateLimitSnapshot {
  remaining: number | null;
  limit: number | null;
  resetAtMs: number | null;
}

export interface RateLimitAdapter {
  readonly name: string;
  bucketKey(
    config: import("../types").ProviderConfig,
    url: string,
  ): string | null;
  parseSnapshot(headers: Headers): RateLimitSnapshot | null;
  isRateLimited(status: number, body: string, headers: Headers): boolean;
  retryAfterMs(status: number, body: string, headers: Headers): number;
}
