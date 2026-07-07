import { describe, expect, test } from "bun:test";

describe("linear team parsing", () => {
  test("detects linear team and project URLs", async () => {
    const { detectIssueProviderFromUrl, parseLinearTeam } =
      await import("@servicebeard/shared");

    expect(
      detectIssueProviderFromUrl("https://linear.app/acme/team/ENG/active"),
    ).toEqual({
      provider: "linear",
      providerBaseUrl: "https://linear.app",
      providerProjectId: "team:acme/ENG",
    });

    expect(
      detectIssueProviderFromUrl(
        "https://linear.app/hongaar/project/servicebeard-support-f0a3393752bf/overview",
      ),
    ).toEqual({
      provider: "linear",
      providerBaseUrl: "https://linear.app",
      providerProjectId: "project:hongaar/servicebeard-support-f0a3393752bf",
    });

    expect(parseLinearTeam("72b2a2dc-6f4f-4423-9d34-24b5bd10634a")).toBe(
      "72b2a2dc-6f4f-4423-9d34-24b5bd10634a",
    );
    expect(
      parseLinearTeam("https://linear.app/acme/issue/ENG-12/some-title"),
    ).toBe("ENG");
  });
});
