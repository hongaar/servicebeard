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
  test("persists provider errors with project context", () => {
    const { recorder, persisted, bugsink } = createTestRecorder();
    const err = new ProviderApiError(500, "GitHub API failed");

    recorder.logExternalError("github", "create-issue", err, {
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

  test("skips persistence for quiet provider 404s", () => {
    const { recorder, persisted, bugsink } = createTestRecorder();
    const err = new ProviderApiError(404, "Not found");

    recorder.logExternalError("gitlab", "list-comments", err, {
      projectId: "proj-1",
    });

    expect(persisted).toHaveLength(0);
    expect(bugsink).toHaveLength(0);
  });

  test("records success status events fire-and-forget", async () => {
    const { recorder, persisted } = createTestRecorder();

    recorder.recordSyncStatusEvent({
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
});
