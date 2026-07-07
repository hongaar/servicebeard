import { describe, expect, test } from "bun:test";

describe("GitLab webhook parsing", () => {
  test("parses note event", async () => {
    const { GitLabProvider } = await import("@servicebeard/providers");
    const provider = new GitLabProvider({
      baseUrl: "https://gitlab.com",
      projectId: "1",
      token: "token",
    });

    const event = provider.parseWebhook({
      object_kind: "note",
      object_attributes: {
        id: 42,
        note: "Thanks for the report",
        noteable_type: "Issue",
        internal: false,
        created_at: "2026-01-01T12:00:00Z",
      },
      user: { id: 5, username: "agent", name: "Support Agent" },
      issue: { id: 100, iid: 7 },
    });

    expect(event).not.toBeNull();
    expect(event!.noteId).toBe("42");
    expect(event!.issueIid).toBe(7);
    expect(event!.authorName).toBe("Support Agent");
    expect(event!.authorUsername).toBe("agent");
    expect(event!.internal).toBe(false);
    expect(event!.system).toBe(false);
  });

  test("skips system notes", async () => {
    const { GitLabProvider } = await import("@servicebeard/providers");
    const provider = new GitLabProvider({
      baseUrl: "https://gitlab.com",
      projectId: "1",
      token: "token",
    });

    const event = provider.parseWebhook({
      object_kind: "note",
      object_attributes: {
        id: 43,
        note: "assigned to @agent",
        noteable_type: "Issue",
        system: true,
        created_at: "2026-01-01T12:00:00Z",
      },
      user: { id: 5, username: "agent", name: "Support Agent" },
      issue: { id: 100, iid: 7 },
    });

    expect(event).toBeNull();
  });

  test("skips non-issue notes", async () => {
    const { GitLabProvider } = await import("@servicebeard/providers");
    const provider = new GitLabProvider({
      baseUrl: "https://gitlab.com",
      projectId: "1",
      token: "token",
    });

    const event = provider.parseWebhook({
      object_kind: "note",
      object_attributes: {
        id: 42,
        noteable_type: "MergeRequest",
      },
    });

    expect(event).toBeNull();
  });
});
