import { ProviderApiError } from "@servicebeard/providers";
import { describe, expect, mock, test } from "bun:test";
import { createSyncEventRecorder } from "./sync-event-recorder";

function createTestRecorder() {
  const logs: Array<{
    level: string;
    obj: Record<string, unknown>;
    msg: string;
  }> = [];
  const persisted: Array<Record<string, unknown>> = [];
  const bugsink: Array<{ err: unknown; info: unknown }> = [];

  const recorder = createSyncEventRecorder({
    logger: {
      debug: (obj, msg) => logs.push({ level: "debug", obj, msg }),
      warn: (obj, msg) => logs.push({ level: "warn", obj, msg }),
      error: (obj, msg) => logs.push({ level: "error", obj, msg }),
    },
    persistEvent: mock(async (input) => {
      persisted.push(input);
    }),
    providerErrorDetails: (err) => {
      if (!(err instanceof ProviderApiError)) return null;
      return {
        status: err.status,
        message: err.message,
        name: err.name,
        responseBody: err.responseBody,
      };
    },
    onExternalError: (err, info) => {
      bugsink.push({ err, info });
    },
  });

  return { recorder, logs, persisted, bugsink };
}

describe("createSyncEventRecorder", () => {
  test("recordProjectSyncEvent persists provider errors with project context", () => {
    const { recorder, persisted, bugsink } = createTestRecorder();
    const err = new ProviderApiError(500, "GitHub API failed");

    recorder.recordProjectSyncEvent({
      service: "github",
      operation: "create-issue",
      severity: "error",
      err,
      projectId: "proj-1",
    });

    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      projectId: "proj-1",
      service: "github",
      operation: "create-issue",
      message: "GitHub API failed",
      severity: "error",
    });
    expect(bugsink).toHaveLength(1);
  });

  test("logExternalError delegates to recordProjectSyncEvent failure path", () => {
    const { recorder, persisted } = createTestRecorder();
    const err = new Error("mailbox timeout");

    recorder.logExternalError("imap", "fetch-since", err, {
      projectId: "proj-1",
    });

    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      projectId: "proj-1",
      severity: "warning",
    });
  });

  test("skips persistence for quiet provider 404s", () => {
    const { recorder, persisted, bugsink } = createTestRecorder();
    const err = new ProviderApiError(404, "Not found");

    recorder.recordProjectSyncEvent({
      service: "gitlab",
      operation: "list-comments",
      severity: "warning",
      err,
      projectId: "proj-1",
    });

    expect(persisted).toHaveLength(0);
    expect(bugsink).toHaveLength(0);
  });

  test("records success events fire-and-forget", async () => {
    const { recorder, persisted } = createTestRecorder();

    recorder.recordProjectSyncEvent({
      projectId: "proj-1",
      service: "github",
      operation: "create-issue",
      severity: "success",
      message: "Created issue #12",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      severity: "success",
      message: "Created issue #12",
    });
  });

  test("classifies queue poll aliases as mail and provider operations", async () => {
    const { classifySyncError, classifySyncFailureSeverity } =
      await import("./constants");

    expect(classifySyncError("worker", "imap-poll")).toBe("mail");
    expect(classifySyncError("worker", "comment-poll")).toBe("provider");
    expect(classifySyncFailureSeverity("imap-poll")).toBe("warning");
    expect(classifySyncFailureSeverity("comment-poll")).toBe("warning");
  });
});
