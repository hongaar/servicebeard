import { describe, expect, test } from "bun:test";

describe("detectIssueProviderFromUrl", () => {
  test("detects GitHub cloud repository URLs", async () => {
    const { detectIssueProviderFromUrl } = await import("@servicebeard/shared");
    expect(
      detectIssueProviderFromUrl("https://github.com/acme/support"),
    ).toEqual({
      provider: "github",
      providerBaseUrl: "https://github.com",
      providerProjectId: "acme/support",
    });
    expect(
      detectIssueProviderFromUrl("https://github.com/acme/support/issues/12"),
    ).toEqual({
      provider: "github",
      providerBaseUrl: "https://github.com",
      providerProjectId: "acme/support",
    });
  });

  test("detects GitLab cloud project URLs", async () => {
    const { detectIssueProviderFromUrl } = await import("@servicebeard/shared");
    expect(
      detectIssueProviderFromUrl("https://gitlab.com/acme/website"),
    ).toEqual({
      provider: "gitlab",
      providerBaseUrl: "https://gitlab.com",
      providerProjectId: "acme/website",
    });
    expect(
      detectIssueProviderFromUrl("https://gitlab.com/acme/website/-/issues/4"),
    ).toEqual({
      provider: "gitlab",
      providerBaseUrl: "https://gitlab.com",
      providerProjectId: "acme/website",
    });
  });

  test("detects self-hosted instances from hostname", async () => {
    const { detectIssueProviderFromUrl } = await import("@servicebeard/shared");
    expect(
      detectIssueProviderFromUrl("https://gitlab.example.com/acme/website"),
    ).toEqual({
      provider: "gitlab",
      providerBaseUrl: "https://gitlab.example.com",
      providerProjectId: "acme/website",
    });
    expect(
      detectIssueProviderFromUrl("https://github.example.com/acme/support"),
    ).toEqual({
      provider: "github",
      providerBaseUrl: "https://github.example.com",
      providerProjectId: "acme/support",
    });
  });

  test("returns null for ambiguous slugs", async () => {
    const { detectIssueProviderFromUrl } = await import("@servicebeard/shared");
    expect(detectIssueProviderFromUrl("acme/support")).toBeNull();
  });
});

describe("parseGitlabProject", () => {
  test("parses paths and URLs", async () => {
    const { parseGitlabProject } = await import("@servicebeard/shared");
    expect(parseGitlabProject("12345")).toBe("12345");
    expect(parseGitlabProject("acme/website")).toBe("acme/website");
    expect(parseGitlabProject("https://gitlab.com/acme/nested/website")).toBe(
      "acme/nested/website",
    );
    expect(parseGitlabProject("git@gitlab.com:acme/website.git")).toBe(
      "acme/website",
    );
  });
});

describe("parseGithubRepository", () => {
  test("accepts owner/repo slug", async () => {
    const { parseGithubRepository } = await import("@servicebeard/shared");
    expect(parseGithubRepository("acme/support")).toBe("acme/support");
    expect(parseGithubRepository("acme/support.git")).toBe("acme/support");
  });

  test("parses repository and issue URLs", async () => {
    const { parseGithubRepository } = await import("@servicebeard/shared");
    expect(
      parseGithubRepository("https://github.com/hongaar/servicebeard-support"),
    ).toBe("hongaar/servicebeard-support");
    expect(
      parseGithubRepository(
        "https://github.com/hongaar/servicebeard-support/issues/1",
      ),
    ).toBe("hongaar/servicebeard-support");
    expect(parseGithubRepository("github.com/acme/support/pull/12")).toBe(
      "acme/support",
    );
  });

  test("normalizes on create when provider is github", async () => {
    const { createProjectSchema } = await import("@servicebeard/shared");
    const parsed = createProjectSchema.parse({
      name: "Support",
      slug: "support",
      provider: "github",
      providerBaseUrl: "https://github.com",
      providerProjectId: "https://github.com/acme/support/issues/3",
      providerToken: "ghp_test",
      imapHost: "imap.example.com",
      imapUser: "support",
      imapPassword: "secret",
      smtpHost: "smtp.example.com",
      smtpUser: "support",
      smtpPassword: "secret",
      smtpFrom: "support@example.com",
    });
    expect(parsed.providerProjectId).toBe("acme/support");
  });
});

describe("provider project URLs", () => {
  test("builds GitHub and GitLab issues URLs", async () => {
    const { providerIssuesWebUrl } = await import("@servicebeard/shared");

    expect(
      providerIssuesWebUrl("github", "https://github.com", "acme/support"),
    ).toBe("https://github.com/acme/support/issues");
    expect(
      providerIssuesWebUrl("gitlab", "https://gitlab.com", "acme/support"),
    ).toBe("https://gitlab.com/acme/support/-/issues");
    expect(providerIssuesWebUrl("gitlab", "https://gitlab.com", "12345")).toBe(
      "https://gitlab.com/projects/12345/issues",
    );
    expect(providerIssuesWebUrl("linear", "https://linear.app", "ENG")).toBe(
      "https://linear.app/team/ENG/active",
    );
    expect(
      providerIssuesWebUrl("linear", "https://linear.app", "team:hongaar/ENG"),
    ).toBe("https://linear.app/hongaar/team/ENG/active");
    expect(
      providerIssuesWebUrl(
        "linear",
        "https://linear.app",
        "project:hongaar/servicebeard-support-f0a3393752bf",
      ),
    ).toBe(
      "https://linear.app/hongaar/project/servicebeard-support-f0a3393752bf/issues",
    );
  });
});
