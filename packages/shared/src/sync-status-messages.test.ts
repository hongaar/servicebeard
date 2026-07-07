import { describe, expect, test } from "bun:test";

describe("sync status messages", () => {
  test("formats success and info messages", async () => {
    const {
      formatAddIssueCommentSuccess,
      formatCreateIssueSuccess,
      formatSendAckInfo,
      formatSendOutboundEmailSuccess,
    } = await import("./sync-status-messages");

    expect(
      formatCreateIssueSuccess({
        issueIid: 42,
        subject: "Help needed",
        senderEmail: "jane@example.com",
        senderName: "Jane",
      }),
    ).toBe(
      'Created issue #42 from email "Help needed" (Jane <jane@example.com>)',
    );

    expect(
      formatAddIssueCommentSuccess({
        issueIid: 7,
        senderEmail: "customer@mail.test",
        senderName: null,
      }),
    ).toBe(
      "Posted customer reply from customer@mail.test as a comment on issue #7",
    );

    expect(
      formatSendAckInfo({
        issueIid: 42,
        recipientEmail: "jane@example.com",
        recipientName: "Jane",
      }),
    ).toBe(
      "Sent acknowledgement email to Jane <jane@example.com> for issue #42",
    );

    expect(
      formatSendOutboundEmailSuccess({
        issueIid: 7,
        recipientEmail: "customer@mail.test",
        recipientName: "Customer",
        authorName: "Alex",
      }),
    ).toBe(
      "Sent comment by Alex to Customer <customer@mail.test> for issue #7",
    );
  });
});
