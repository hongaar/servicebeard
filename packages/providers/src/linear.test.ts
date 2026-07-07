import { describe, expect, test } from "bun:test";

describe("linear provider", () => {
  test("parses comment webhook payloads", async () => {
    const { LinearProvider } = await import("@servicebeard/providers");
    const provider = new LinearProvider({
      baseUrl: "https://linear.app",
      projectId: "72b2a2dc-6f4f-4423-9d34-24b5bd10634a",
      token: "lin_api_test",
    });

    const event = provider.parseWebhook({
      action: "create",
      type: "Comment",
      url: "https://linear.app/acme/issue/ENG-42/some-title#comment-abc",
      actor: { id: "user-1", type: "user", name: "Alex" },
      data: {
        id: "comment-1",
        body: "Thanks for the update",
        issueId: "issue-uuid",
        userId: "user-1",
        createdAt: "2026-01-23T12:53:18.084Z",
      },
    });

    expect(event).not.toBeNull();
    expect(event!.issueExternalId).toBe("issue-uuid");
    expect(event!.issueIid).toBe(42);
    expect(event!.noteId).toBe("comment-1");
    expect(event!.internal).toBe(false);
  });

  test("marks internal marker comments", async () => {
    const { LinearProvider } = await import("@servicebeard/providers");
    const provider = new LinearProvider({
      baseUrl: "https://linear.app",
      projectId: "ENG",
      token: "lin_api_test",
    });

    const event = provider.parseWebhook({
      action: "create",
      type: "Comment",
      url: "https://linear.app/acme/issue/ENG-7/title",
      actor: { id: "user-1", type: "user", name: "Alex" },
      data: {
        id: "comment-2",
        body: "[internal] Checking with billing",
        issueId: "issue-uuid",
        userId: "user-1",
      },
    });

    expect(event?.internal).toBe(true);
  });

  test("skips non-user actors", async () => {
    const { LinearProvider } = await import("@servicebeard/providers");
    const provider = new LinearProvider({
      baseUrl: "https://linear.app",
      projectId: "ENG",
      token: "lin_api_test",
    });

    const event = provider.parseWebhook({
      action: "create",
      type: "Comment",
      actor: { id: "integration-1", type: "integration", name: "Bot" },
      data: { id: "comment-3", issueId: "issue-uuid", body: "Hello" },
    });

    expect(event).toBeNull();
  });

  test("verifies webhook signature and timestamp", async () => {
    const { createHmac } = await import("node:crypto");
    const { LinearProvider } = await import("@servicebeard/providers");
    const provider = new LinearProvider({
      baseUrl: "https://linear.app",
      projectId: "ENG",
      token: "lin_api_test",
    });

    const body = JSON.stringify({ webhookTimestamp: Date.now() });
    const secret = "test-secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    expect(
      provider.verifyWebhook({ "linear-signature": signature }, body, secret),
    ).toBe(true);
    expect(
      provider.verifyWebhook({ "linear-signature": "bad" }, body, secret),
    ).toBe(false);
  });
});
