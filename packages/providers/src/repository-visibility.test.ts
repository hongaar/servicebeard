import { afterEach, describe, expect, mock, test } from "bun:test";

describe("lookupRepositoryVisibility", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("detects public GitHub repositories", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ private: false }),
    ) as unknown as typeof fetch;

    const { lookupRepositoryVisibility } =
      await import("./repository-visibility");
    await expect(
      lookupRepositoryVisibility({
        provider: "github",
        baseUrl: "https://github.com",
        projectId: "acme/support",
      }),
    ).resolves.toBe("public");
  });

  test("detects private GitHub repositories", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ private: true }),
    ) as unknown as typeof fetch;

    const { lookupRepositoryVisibility } =
      await import("./repository-visibility");
    await expect(
      lookupRepositoryVisibility({
        provider: "github",
        baseUrl: "https://github.com",
        projectId: "acme/support",
      }),
    ).resolves.toBe("private");
  });

  test("returns unknown when GitHub repository cannot be resolved", async () => {
    const { lookupRepositoryVisibility } =
      await import("./repository-visibility");
    await expect(
      lookupRepositoryVisibility({
        provider: "github",
        baseUrl: "https://github.com",
        projectId: "not-a-valid-slug",
      }),
    ).resolves.toBe("unknown");
  });

  test("detects public GitLab projects", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ visibility: "public" }),
    ) as unknown as typeof fetch;

    const { lookupRepositoryVisibility } =
      await import("./repository-visibility");
    await expect(
      lookupRepositoryVisibility({
        provider: "gitlab",
        baseUrl: "https://gitlab.com",
        projectId: "acme/website",
      }),
    ).resolves.toBe("public");
  });

  test("detects private GitLab projects", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ visibility: "private" }),
    ) as unknown as typeof fetch;

    const { lookupRepositoryVisibility } =
      await import("./repository-visibility");
    await expect(
      lookupRepositoryVisibility({
        provider: "gitlab",
        baseUrl: "https://gitlab.com",
        projectId: "acme/website",
      }),
    ).resolves.toBe("private");
  });

  test("returns unknown when provider API lookup fails", async () => {
    globalThis.fetch = mock(
      async () => new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;

    const { lookupRepositoryVisibility } =
      await import("./repository-visibility");
    await expect(
      lookupRepositoryVisibility({
        provider: "gitlab",
        baseUrl: "https://gitlab.com",
        projectId: "acme/website",
      }),
    ).resolves.toBe("unknown");
  });
});

describe("isPublicRepositoryVisibility", () => {
  test("is true only for public visibility", async () => {
    const { isPublicRepositoryVisibility } =
      await import("./repository-visibility");
    expect(isPublicRepositoryVisibility("public")).toBe(true);
    expect(isPublicRepositoryVisibility("private")).toBe(false);
    expect(isPublicRepositoryVisibility("internal")).toBe(false);
    expect(isPublicRepositoryVisibility("unknown")).toBe(false);
  });
});
