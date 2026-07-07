import { describe, expect, test } from "bun:test";

describe("sync error messages", () => {
  test("humanizes vague Bun connection errors with service context", async () => {
    const { humanizeSyncErrorMessage } = await import("./sync-error-messages");
    expect(
      humanizeSyncErrorMessage(
        "github",
        "list-comments",
        new Error("Unable to connect. Is the computer able to access the url?"),
      ),
    ).toBe("Could not connect to GitHub while checking for new issue comments");
    expect(
      humanizeSyncErrorMessage(
        "github",
        "list-comments",
        new Error("Was there a typo in the url or port?"),
      ),
    ).toBe(
      "Invalid URL or port while checking for new issue comments (GitHub)",
    );
  });

  test("humanizes IMAP command failures with server response text", async () => {
    const { humanizeSyncErrorMessage } = await import("./sync-error-messages");
    const err = new Error("Command failed") as Error & {
      responseText?: string;
    };
    err.responseText = "SEARCH command failed: invalid date";
    expect(humanizeSyncErrorMessage("imap", "fetch-since", err)).toBe(
      "IMAP mailbox rejected a command while fetching new mailbox messages: SEARCH command failed: invalid date",
    );
  });
});
