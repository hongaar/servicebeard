import { beforeAll, describe, expect, test } from "bun:test";

describe("crypto", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  test("encrypt/decrypt roundtrip", async () => {
    const { encrypt, decrypt } = await import("@servicebeard/db");
    const plaintext = "secret-token-12345";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  test("hashToken is deterministic", async () => {
    const { hashToken } = await import("@servicebeard/db");
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("def"));
  });

  test("rejects non-hex encryption keys", async () => {
    process.env.ENCRYPTION_KEY =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/";
    const { encrypt } = await import("@servicebeard/db");
    expect(() => encrypt("secret")).toThrow(/64-character hex string/);
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });
});
