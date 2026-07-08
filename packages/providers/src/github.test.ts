import { describe, expect, mock, test } from "bun:test";

describe("GitHub webhook parsing", () => {
  test("parses issue_comment created event", async () => {
    const { GitHubProvider } = await import("@servicebeard/providers");
    const provider = new GitHubProvider({
      baseUrl: "https://github.com",
      projectId: "octocat/Hello-World",
      token: "token",
    });

    const event = provider.parseWebhook({
      action: "created",
      issue: { id: 100, number: 7 },
      comment: {
        id: 42,
        body: "Thanks for the report",
        user: { id: 5, login: "agent", name: "Support Agent" },
        created_at: "2026-01-01T12:00:00Z",
      },
    });

    expect(event).not.toBeNull();
    expect(event!.noteId).toBe("42");
    expect(event!.issueIid).toBe(7);
    expect(event!.authorName).toBe("Support Agent");
    expect(event!.authorUsername).toBe("agent");
  });

  test("leaves authorName null when webhook user has no name", async () => {
    const { GitHubProvider } = await import("@servicebeard/providers");
    const provider = new GitHubProvider({
      baseUrl: "https://github.com",
      projectId: "octocat/Hello-World",
      token: "token",
    });

    const event = provider.parseWebhook({
      action: "created",
      issue: { id: 100, number: 7 },
      comment: {
        id: 42,
        body: "Thanks for the report",
        user: { id: 5, login: "agent" },
        created_at: "2026-01-01T12:00:00Z",
      },
    });

    expect(event).not.toBeNull();
    expect(event!.authorName).toBeNull();
    expect(event!.authorUsername).toBe("agent");
  });

  test("skips bot comments", async () => {
    const { GitHubProvider } = await import("@servicebeard/providers");
    const provider = new GitHubProvider({
      baseUrl: "https://github.com",
      projectId: "octocat/Hello-World",
      token: "token",
    });

    const event = provider.parseWebhook({
      action: "created",
      issue: { id: 100, number: 7 },
      comment: {
        id: 43,
        body: "automated",
        user: { id: 1, login: "bot", type: "Bot" },
        created_at: "2026-01-01T12:00:00Z",
      },
    });

    expect(event).toBeNull();
  });

  test("builds private-repo-safe attachment URLs", async () => {
    const { GITHUB_ATTACHMENTS_BRANCH, githubIssueAttachmentUrl } =
      await import("@servicebeard/providers");

    expect(
      githubIssueAttachmentUrl(
        "https://github.com",
        "octocat",
        "Hello-World",
        GITHUB_ATTACHMENTS_BRANCH,
        ".servicebeard/attachments/uuid/inline-image-1.png",
      ),
    ).toBe(
      `https://github.com/octocat/Hello-World/raw/${GITHUB_ATTACHMENTS_BRANCH}/.servicebeard/attachments/uuid/inline-image-1.png`,
    );

    expect(
      githubIssueAttachmentUrl(
        "https://github.com",
        "octocat",
        "Hello-World",
        GITHUB_ATTACHMENTS_BRANCH,
        ".servicebeard/attachments/uuid/emojis.com long-blue-wizard-beard.png",
      ),
    ).toBe(
      `https://github.com/octocat/Hello-World/raw/${GITHUB_ATTACHMENTS_BRANCH}/.servicebeard/attachments/uuid/emojis.com%20long-blue-wizard-beard.png`,
    );
  });

  test("verifies webhook signature", async () => {
    const { createHmac } = await import("node:crypto");
    const { GitHubProvider } = await import("@servicebeard/providers");
    const provider = new GitHubProvider({
      baseUrl: "https://github.com",
      projectId: "octocat/Hello-World",
      token: "token",
    });

    const body = '{"action":"created"}';
    const secret = "test-secret";
    const signature =
      "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

    expect(
      provider.verifyWebhook(
        { "x-hub-signature-256": signature },
        body,
        secret,
      ),
    ).toBe(true);
    expect(
      provider.verifyWebhook(
        { "x-hub-signature-256": "sha256=bad" },
        body,
        secret,
      ),
    ).toBe(false);
  });
});

describe("GitHub author display names", () => {
  test("resolveAuthorDisplayName uses profile name when webhook omits it", async () => {
    const fetchMock = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 5, login: "agent", name: "Support Agent" }),
      text: async () => "",
    }));
    mock.module("./http", () => ({
      providerFetch: fetchMock,
    }));

    const { GitHubProvider } = await import("@servicebeard/providers");
    const provider = new GitHubProvider({
      baseUrl: "https://github.com",
      projectId: "octocat/Hello-World",
      token: "token",
    });

    await expect(
      provider.resolveAuthorDisplayName({
        authorName: null,
        authorUsername: "agent",
      }),
    ).resolves.toBe("Support Agent");
  });

  test("resolveAuthorDisplayName falls back to username when profile has no name", async () => {
    const fetchMock = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 5, login: "no-name-user", name: null }),
      text: async () => "",
    }));
    mock.module("./http", () => ({
      providerFetch: fetchMock,
    }));

    const { GitHubProvider } = await import("@servicebeard/providers");
    const provider = new GitHubProvider({
      baseUrl: "https://github.com",
      projectId: "octocat/Hello-World",
      token: "token",
    });

    await expect(
      provider.resolveAuthorDisplayName({
        authorName: null,
        authorUsername: "no-name-user",
      }),
    ).resolves.toBe("no-name-user");
  });

  test("resolveUserDisplayName reuses cached profile for 24h", async () => {
    const fetchMock = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 9,
        login: "cached-user",
        name: "Cached Name",
      }),
      text: async () => "",
    }));
    mock.module("./http", () => ({
      providerFetch: fetchMock,
    }));

    const { GitHubProvider } = await import("@servicebeard/providers");
    const provider = new GitHubProvider({
      baseUrl: "https://github.com",
      projectId: "octocat/Hello-World",
      token: "token",
    });

    await expect(provider.resolveUserDisplayName("cached-user")).resolves.toBe(
      "Cached Name",
    );
    await expect(provider.resolveUserDisplayName("cached-user")).resolves.toBe(
      "Cached Name",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
