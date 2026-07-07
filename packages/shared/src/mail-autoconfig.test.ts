import { describe, expect, test } from "bun:test";

describe("mail autoconfig", () => {
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
