import type { IssueProvider } from "@servicebeard/providers";
import { testEmail } from "@servicebeard/shared/testing/email-fixtures";
import { describe, expect, mock, test } from "bun:test";
import { resolveEmailMarkdown } from "./email-content";

function mockProvider(): IssueProvider {
  return {
    uploadFile: mock(async () => ({
      markdown: "![uploaded](https://example.com/uploaded.png)",
    })),
  } as unknown as IssueProvider;
}

describe("resolveEmailMarkdown", () => {
  test("does not upload quoted branded logos on plain-text replies", async () => {
    const provider = mockProvider();
    const markdown = await resolveEmailMarkdown(
      testEmail({
        messageId: "<reply@mail.test>",
        inReplyTo: "<parent@servicebeard.local>",
        references: [],
        toAddresses: [],
        ccAddresses: [],
        bccAddresses: [],
        fromEmail: "customer@mail.test",
        fromName: "customer",
        subject: "Re: problem",
        body: "plaintextreply",
        bodyMarkdown: "plaintextreply",
        inlineImages: [
          {
            filename: "logo.png",
            contentType: "image/png",
            content: Buffer.from("fake-logo"),
            contentId: null,
            contentDisposition: "inline",
          },
        ],
        date: new Date("2026-07-10T12:00:00Z"),
      }),
      provider,
      "project-1",
    );

    expect(markdown).toBe("plaintextreply");
    expect(provider.uploadFile).not.toHaveBeenCalled();
  });
});
