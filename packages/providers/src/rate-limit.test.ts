import { afterEach, describe, expect, mock, test } from "bun:test";
import { rateLimitAdapters } from "./rate-limit/adapters";
import {
  hashRateLimitCredential,
  rateLimitBucketKeyForProvider,
  resetRateLimitBucketsForTests,
} from "./rate-limit/bucket";

describe("rate limit bucket keys", () => {
  test("isolates GitHub App installations", () => {
    const installA = rateLimitBucketKeyForProvider("github", {
      baseUrl: "https://github.com",
      projectId: "org-a/repo",
      token: "",
      githubInstallationId: "111",
    });
    const installB = rateLimitBucketKeyForProvider("github", {
      baseUrl: "https://github.com",
      projectId: "org-b/repo",
      token: "",
      githubInstallationId: "222",
    });

    expect(installA).toBe("github:https://github.com:install:111");
    expect(installB).toBe("github:https://github.com:install:222");
    expect(installA).not.toBe(installB);
  });

  test("groups GitLab projects by token", () => {
    const key = rateLimitBucketKeyForProvider("gitlab", {
      baseUrl: "https://gitlab.com",
      projectId: "1",
      token: "glpat-test",
    });
    expect(key).toBe(
      `gitlab:https://gitlab.com:token:${hashRateLimitCredential("glpat-test")}`,
    );
  });

  test("groups Linear projects by token", () => {
    const key = rateLimitBucketKeyForProvider("linear", {
      baseUrl: "https://linear.app",
      projectId: "team:abc",
      token: "lin_api_test",
    });
    expect(key).toBe(`linear:token:${hashRateLimitCredential("lin_api_test")}`);
  });
});

describe("rate limit adapters", () => {
  test("detects Linear GraphQL RATELIMITED bodies", () => {
    const body = JSON.stringify({
      errors: [
        { message: "Rate limit exceeded", extensions: { code: "RATELIMITED" } },
      ],
    });
    expect(
      rateLimitAdapters.linear.isRateLimited(400, body, new Headers()),
    ).toBe(true);
    expect(
      rateLimitAdapters.github.isRateLimited(400, body, new Headers()),
    ).toBe(false);
  });

  test("parses GitHub and GitLab quota headers", () => {
    const github = rateLimitAdapters.github.parseSnapshot(
      new Headers({
        "X-RateLimit-Remaining": "12",
        "X-RateLimit-Limit": "5000",
        "X-RateLimit-Reset": "1609844400",
      }),
    );
    expect(github).toEqual({
      remaining: 12,
      limit: 5000,
      resetAtMs: 1609844400 * 1000,
    });

    const gitlab = rateLimitAdapters.gitlab.parseSnapshot(
      new Headers({
        "RateLimit-Remaining": "8",
        "RateLimit-Limit": "2000",
        "RateLimit-Reset": "1609844400",
      }),
    );
    expect(gitlab).toEqual({
      remaining: 8,
      limit: 2000,
      resetAtMs: 1609844400 * 1000,
    });
  });
});

describe("providerFetch rate limiting", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    resetRateLimitBucketsForTests();
    mock.restore();
    globalThis.fetch = originalFetch;
  });

  test("throws ProviderRateLimitError on rate limit without inline retry", async () => {
    mock.restore();
    const fetchMock = mock(
      async () =>
        new Response("rate limited", {
          status: 429,
          headers: {
            "Retry-After": "0",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
          },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { providerFetch } = await import(
      `./http?rate-limit-immediate=${Date.now()}`
    );
    const { ProviderRateLimitError } = await import("./errors");

    await expect(
      providerFetch(
        {
          baseUrl: "https://github.com",
          projectId: "org/repo",
          token: "token",
          githubInstallationId: "123",
        },
        "https://api.github.com/repos/org/repo/issues",
      ),
    ).rejects.toBeInstanceOf(ProviderRateLimitError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("throws ProviderRateLimitError immediately on long backoff", async () => {
    mock.restore();
    const fetchMock = mock(
      async () =>
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "60" },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { providerFetch } = await import(
      `./http?rate-limit-long=${Date.now()}`
    );
    const { ProviderRateLimitError } = await import("./errors");

    await expect(
      providerFetch(
        {
          baseUrl: "https://gitlab.com",
          projectId: "1",
          token: "glpat-test",
        },
        "https://gitlab.com/api/v4/projects/1",
      ),
    ).rejects.toBeInstanceOf(ProviderRateLimitError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
