import { describe, expect, test } from "bun:test";

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
