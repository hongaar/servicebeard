import { describe, expect, test } from "bun:test";

describe("mail connection errors", () => {
  test("maps SMTP connection closed on port 465 to actionable guidance", async () => {
    const { formatMailConnectionError } =
      await import("./mail-connection-error");

    const err = formatMailConnectionError(
      { protocol: "SMTP", host: "smtp.migadu.com", port: 465, secure: true },
      new Error("Connection closed"),
    );

    expect(err.message).toContain(
      "SMTP connection to smtp.migadu.com:465 (TLS)",
    );
    expect(err.message).toContain("Port 465 is often blocked");
    expect(err.message).toContain("587");
  });

  test("maps SMTP timeout on port 465 to actionable guidance", async () => {
    const { formatMailConnectionError } =
      await import("./mail-connection-error");

    const err = formatMailConnectionError(
      { protocol: "SMTP", host: "smtp.migadu.com", port: 465, secure: true },
      new Error("Connection timeout"),
    );

    expect(err.message).toContain("timed out");
    expect(err.message).toContain("587");
  });

  test("maps authentication failures clearly", async () => {
    const { formatMailConnectionError } =
      await import("./mail-connection-error");

    const err = formatMailConnectionError(
      { protocol: "IMAP", host: "imap.migadu.com", port: 993, secure: true },
      new Error("Invalid login: 535 5.7.8 Error: authentication failed"),
    );

    expect(err.message).toContain("IMAP authentication failed");
    expect(err.message).toContain("username and password");
  });
});
