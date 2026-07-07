import { describe, expect, test } from "bun:test";

describe("internal comment marker", () => {
  test("detects [internal] at start or end only", async () => {
    const { isServicebeardInternalContent } =
      await import("@servicebeard/shared");

    expect(
      isServicebeardInternalContent("[internal] Checking with billing"),
    ).toBe(true);
    expect(
      isServicebeardInternalContent("[INTERNAL] Checking with billing"),
    ).toBe(true);
    expect(isServicebeardInternalContent("Need another look [internal]")).toBe(
      true,
    );
    expect(isServicebeardInternalContent("  [internal]  ")).toBe(true);
    expect(
      isServicebeardInternalContent("See [internal] docs for details"),
    ).toBe(false);
    expect(isServicebeardInternalContent("Regular customer-facing reply")).toBe(
      false,
    );
  });
});
