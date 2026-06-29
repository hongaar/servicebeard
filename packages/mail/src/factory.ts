import { loadMonorepoEnv } from "@servicebeard/shared/env";
import { NoopMailAdapter } from "./noop";
import { SmtpMailAdapter } from "./smtp";
import type { MailAdapter, MailAdapterType } from "./types";

function parseAdapterType(): MailAdapterType {
  const value = process.env.MAIL_ADAPTER?.trim().toLowerCase();
  if (value === "noop") return "noop";
  return "smtp";
}

function smtpEnvFingerprint(): string {
  return [
    process.env.SYSTEM_SMTP_HOST,
    process.env.SYSTEM_SMTP_PORT,
    process.env.SYSTEM_SMTP_SECURE,
    process.env.SYSTEM_SMTP_USER,
    process.env.SYSTEM_SMTP_PASSWORD,
    process.env.SYSTEM_SMTP_FROM,
    process.env.MAIL_FROM_NAME,
  ].join("|");
}

function createSmtpAdapter(): SmtpMailAdapter | NoopMailAdapter {
  const host = process.env.SYSTEM_SMTP_HOST?.trim();
  const from = process.env.SYSTEM_SMTP_FROM?.trim();
  if (!host || !from) {
    return new NoopMailAdapter();
  }

  const port = Number(process.env.SYSTEM_SMTP_PORT ?? "587");
  const secure = process.env.SYSTEM_SMTP_SECURE === "true";
  const user = process.env.SYSTEM_SMTP_USER?.trim();
  const password = process.env.SYSTEM_SMTP_PASSWORD;

  return new SmtpMailAdapter({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    user: user || undefined,
    password: password || undefined,
    from,
    fromName: process.env.MAIL_FROM_NAME?.trim() || undefined,
  });
}

let cachedAdapter: MailAdapter | null = null;
let cachedFingerprint = "";

export function createMailAdapter(): MailAdapter {
  loadMonorepoEnv();

  const fingerprint = smtpEnvFingerprint();
  if (cachedAdapter && cachedFingerprint === fingerprint) {
    return cachedAdapter;
  }

  const type = parseAdapterType();
  cachedAdapter = type === "smtp" ? createSmtpAdapter() : new NoopMailAdapter();
  cachedFingerprint = fingerprint;
  return cachedAdapter;
}

export function isMailConfigured(): boolean {
  return createMailAdapter().isConfigured();
}

export function resetMailAdapterForTests(): void {
  cachedAdapter = null;
  cachedFingerprint = "";
}
