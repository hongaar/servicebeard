import { describe, expect, test } from "bun:test";
import { normalizeSubject } from "./constants";

describe("loop prevention markers", () => {
  test("detects servicebeard-sync content", async () => {
    const { buildSyncMarker, isServicebeardSyncedContent } =
      await import("@servicebeard/shared");
    const marker = buildSyncMarker("email:<m@mail.test>");
    expect(isServicebeardSyncedContent(`Reply text\n\n${marker}`)).toBe(true);
    expect(isServicebeardSyncedContent("Regular agent reply")).toBe(false);

    const linearMarker = buildSyncMarker("thread-1", "linear");
    expect(linearMarker).toContain("[//]: # (servicebeard-sync:thread-1)");
    expect(isServicebeardSyncedContent(`Reply text\n\n${linearMarker}`)).toBe(
      true,
    );
  });
});

describe("normalizeSubject", () => {
  test("strips Re: prefix", () => {
    expect(normalizeSubject("Re: Hello")).toBe("hello");
    expect(normalizeSubject("Fwd: Test")).toBe("test");
  });
});

describe("isReplySubject", () => {
  test("detects reply prefixes", async () => {
    const { isReplySubject } = await import("@servicebeard/shared");
    expect(isReplySubject("Re: Hello")).toBe(true);
    expect(isReplySubject("Fwd: Test")).toBe(true);
    expect(isReplySubject("FW: Test")).toBe(true);
    expect(isReplySubject("Hello")).toBe(false);
    expect(isReplySubject("test")).toBe(false);
  });
});

describe("sync error classification", () => {
  test("classifies mail and provider operations", async () => {
    const { classifySyncError } = await import("@servicebeard/shared");
    expect(classifySyncError("imap", "fetch-unseen")).toBe("mail");
    expect(classifySyncError("smtp", "send-mail")).toBe("mail");
    expect(classifySyncError("smtp", "send-ack")).toBe("mail");
    expect(classifySyncError("smtp", "send-outbound-email")).toBe("mail");
    expect(classifySyncError("github", "list-comments")).toBe("provider");
    expect(classifySyncError("linear", "list-comments")).toBe("provider");
    expect(classifySyncError("linear", "create-issue")).toBe("provider");
    expect(classifySyncError("inbound", "process-message")).toBe("provider");
    expect(classifySyncError("worker", "imap-poll")).toBe("mail");
    expect(classifySyncError("worker", "comment-poll")).toBe("provider");
    expect(classifySyncError("api", "unknown")).toBeNull();
  });

  test("classifies retriable failures as warnings", async () => {
    const { classifySyncFailureSeverity } =
      await import("@servicebeard/shared");
    expect(classifySyncFailureSeverity("process-message")).toBe("warning");
    expect(classifySyncFailureSeverity("list-comments")).toBe("warning");
    expect(classifySyncFailureSeverity("fetch-since")).toBe("warning");
    expect(classifySyncFailureSeverity("imap-poll")).toBe("warning");
    expect(classifySyncFailureSeverity("comment-poll")).toBe("warning");
    expect(classifySyncFailureSeverity("test-provider")).toBe("error");
    expect(classifySyncFailureSeverity("ensure-webhook")).toBe("error");
  });
});
