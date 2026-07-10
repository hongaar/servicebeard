import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  closeAllTransporters,
  credentialFingerprint,
  getTransporter,
  resetTransporterPoolForTests,
  type SmtpCredentials,
} from "./smtp";

const baseCreds: SmtpCredentials = {
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "user-a",
  smtpPassword: "secret-a",
  smtpFrom: "noreply@example.com",
};

let createTransportCalls = 0;

function makeMockTransporter() {
  return {
    sendMail: mock(async () => undefined),
    close: mock(async () => undefined),
  };
}

mock.module("nodemailer", () => ({
  default: {
    createTransport: mock(() => {
      createTransportCalls++;
      return makeMockTransporter();
    }),
  },
}));

beforeEach(() => {
  createTransportCalls = 0;
});

afterEach(async () => {
  await resetTransporterPoolForTests();
});

describe("credentialFingerprint", () => {
  test("matches for identical credentials", () => {
    const other: SmtpCredentials = { ...baseCreds };
    expect(credentialFingerprint(baseCreds)).toBe(credentialFingerprint(other));
  });

  test("differs when password changes", () => {
    const other: SmtpCredentials = {
      ...baseCreds,
      smtpPassword: "secret-b",
    };
    expect(credentialFingerprint(baseCreds)).not.toBe(
      credentialFingerprint(other),
    );
  });

  test("differs when user changes on same host", () => {
    const other: SmtpCredentials = {
      ...baseCreds,
      smtpUser: "user-b",
    };
    expect(credentialFingerprint(baseCreds)).not.toBe(
      credentialFingerprint(other),
    );
  });
});

describe("getTransporter", () => {
  test("reuses transporter for same credential fingerprint", () => {
    const first = getTransporter(baseCreds);
    const second = getTransporter({ ...baseCreds });
    expect(first).toBe(second);
    expect(createTransportCalls).toBe(1);
  });

  test("creates separate transporters for different credentials", () => {
    const first = getTransporter(baseCreds);
    const second = getTransporter({
      ...baseCreds,
      smtpPassword: "secret-b",
    });
    expect(first).not.toBe(second);
    expect(createTransportCalls).toBe(2);
  });
});

describe("closeAllTransporters", () => {
  test("closes pooled transporters and clears cache", async () => {
    const first = getTransporter(baseCreds);
    await closeAllTransporters();
    const reopened = getTransporter(baseCreds);
    expect(reopened).not.toBe(first);
    expect(createTransportCalls).toBe(2);
  });
});
