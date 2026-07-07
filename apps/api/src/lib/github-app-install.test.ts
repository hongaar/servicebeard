import { describe, expect, test } from "bun:test";

describe("github app install cookie", () => {
  test("roundtrips returnTo with query string", async () => {
    const { encodeGithubAppInstallCookie, decodeGithubAppInstallCookie } =
      await import("./github-app-install");
    const payload = {
      state: "abc123",
      teamId: "team-1",
      returnTo: "/teams/team-1/projects?create=1&wizardStep=provider",
      popup: true,
    };
    const encoded = encodeGithubAppInstallCookie(payload);
    expect(encoded).not.toContain("&");
    expect(decodeGithubAppInstallCookie(encoded)).toEqual(payload);
  });
});
