import { afterEach, describe, expect, test } from "bun:test";

const ENV_KEYS = ["BLOCKED_IMAP_PORTS", "BLOCKED_SMTP_PORTS"] as const;

function clearBlockedPortEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  clearBlockedPortEnv();
});

describe("mail port config", () => {
  test("parses comma-separated blocked ports", async () => {
    process.env.BLOCKED_IMAP_PORTS = "143, 993 ";
    process.env.BLOCKED_SMTP_PORTS = "25,465";

    const { getBlockedMailPortsConfig } = await import("./mail-port-config");
    expect(getBlockedMailPortsConfig()).toEqual({
      blockedImapPorts: [143, 993],
      blockedSmtpPorts: [25, 465],
    });
  });

  test("ignores invalid port values", async () => {
    process.env.BLOCKED_SMTP_PORTS = "587,0,70000,abc";

    const { getBlockedSmtpPorts } = await import("./mail-port-config");
    expect(getBlockedSmtpPorts()).toEqual([587]);
  });

  test("returns warnings only for configured blocked ports", async () => {
    process.env.BLOCKED_SMTP_PORTS = "465";

    const { getBlockedMailPortWarnings } = await import("./mail-port-config");
    expect(getBlockedMailPortWarnings(993, 465)).toEqual([
      "Port 465 is blocked on this ServiceBeard instance. Outbound SMTP connections to this port may fail. Try port 587 with STARTTLS if your provider supports it.",
    ]);
    expect(getBlockedMailPortWarnings(993, 587)).toEqual([]);
  });
});
