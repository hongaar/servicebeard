import { describe, expect, test } from "bun:test";

describe("mail autoconfig", () => {
  test("appendSlugSuffix keeps slug within max length", async () => {
    const { appendSlugSuffix } =
      await import("@servicebeard/shared/mail-autoconfig");

    expect(appendSlugSuffix("acme", 2)).toBe("acme-2");
    expect(
      appendSlugSuffix("a-very-long-team-name-that-exceeds-the-limit", 3, 20),
    ).toBe("a-very-long-team-n-3");
  });

  test("mail.test resolves to local GreenMail settings", async () => {
    const { lookupMailAutoconfig, usesLocalPartMailAuth } =
      await import("@servicebeard/shared/mail-autoconfig");

    const config = lookupMailAutoconfig("support@mail.test");
    expect(config?.providerName).toBe("GreenMail (local dev)");
    expect(config?.imap).toEqual({
      host: "localhost",
      port: 3143,
      secure: false,
    });
    expect(config?.smtp).toEqual({
      host: "localhost",
      port: 3025,
      secure: false,
    });
    expect(usesLocalPartMailAuth("support@mail.test")).toBe(true);
    expect(usesLocalPartMailAuth("support@gmail.com")).toBe(false);
  });
});
