import { describe, expect, test } from "bun:test";
import { isClosedProviderStatus, resolveReopenStatus } from "./issue-reopen";

describe("isClosedProviderStatus", () => {
  test("detects closed statuses", () => {
    expect(isClosedProviderStatus("closed")).toBe(true);
    expect(isClosedProviderStatus("Closed")).toBe(true);
    expect(isClosedProviderStatus("open")).toBe(false);
    expect(isClosedProviderStatus("opened")).toBe(false);
    expect(isClosedProviderStatus(null)).toBe(false);
  });
});

describe("resolveReopenStatus", () => {
  test("uses rule status when set and not closed", () => {
    expect(resolveReopenStatus("gid://gitlab/Status/1", "opened")).toBe(
      "gid://gitlab/Status/1",
    );
    expect(resolveReopenStatus("open", "opened")).toBe("open");
  });

  test("falls back to default open when rule status is closed or unset", () => {
    expect(resolveReopenStatus("closed", "opened")).toBe("opened");
    expect(resolveReopenStatus("Closed", "open")).toBe("open");
    expect(resolveReopenStatus(null, "opened")).toBe("opened");
    expect(resolveReopenStatus(undefined, "state-123")).toBe("state-123");
  });
});
