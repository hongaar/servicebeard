import { describe, expect, test } from "bun:test";

describe("provider error messages", () => {
  test("formats provider upload errors without embedding raw response bodies", async () => {
    const {
      githubUploadErrorMessage,
      githubApiErrorMessage,
      linearUploadErrorMessage,
    } = await import("./error-messages");
    expect(
      githubUploadErrorMessage(
        422,
        '{"message":"Bad Size","request_id":"abc"}',
      ),
    ).toBe(
      "GitHub rejected the image upload because the file size metadata was missing or invalid",
    );
    expect(
      linearUploadErrorMessage(
        400,
        "<?xml version='1.0'?><Error><Code>MalformedSecurityHeader</Code><Message>Invalid argument.</Message></Error>",
      ),
    ).toBe(
      "Linear image upload failed because the storage upload was missing a required Content-Type header",
    );
    expect(
      githubApiErrorMessage(
        403,
        "/repos/acme/support/contents/.servicebeard/attachments/x.png",
        '{"message":"Resource not accessible by integration"}',
      ),
    ).toContain("Contents read/write permission");
  });
});
