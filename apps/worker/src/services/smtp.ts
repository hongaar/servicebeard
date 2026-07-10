import { normalizeMessageId, parseMailFromAddress } from "@servicebeard/shared";
import { createHash, randomBytes } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { logExternalError } from "../lib/external-error";
import { smtpTlsOptions } from "../lib/smtp-tls";
import {
  getSmtpIdleTtlMs,
  getSmtpMaxConnections,
  getSmtpMaxMessages,
  getSmtpMaxPools,
  SMTP_CONNECTION_TIMEOUT_MS,
  SMTP_GREETING_TIMEOUT_MS,
  SMTP_SOCKET_TIMEOUT_MS,
} from "../lib/worker-config";

export interface SmtpCredentials {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
}

export interface OutboundEmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  cid: string;
}

export interface OutboundEmail {
  to: string;
  toName?: string | null;
  cc?: string | string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments?: OutboundEmailAttachment[];
  inReplyTo?: string | null;
  references?: string[];
}

interface PooledTransporter {
  transporter: Transporter;
  lastUsed: number;
}

const transporterPools = new Map<string, PooledTransporter>();
let sweeper: ReturnType<typeof setInterval> | undefined;

export function credentialFingerprint(creds: SmtpCredentials): string {
  const material = [
    creds.smtpHost,
    creds.smtpPort,
    creds.smtpSecure,
    creds.smtpUser,
    creds.smtpPassword,
  ].join("\n");
  return createHash("sha256").update(material).digest("hex");
}

function createPooledTransporter(creds: SmtpCredentials): Transporter {
  return nodemailer.createTransport({
    pool: true,
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: creds.smtpSecure,
    auth: { user: creds.smtpUser, pass: creds.smtpPassword },
    maxConnections: getSmtpMaxConnections(),
    maxMessages: getSmtpMaxMessages(),
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    tls: smtpTlsOptions(creds.smtpHost),
  });
}

function evictIdlePools(now = Date.now()): void {
  const idleTtlMs = getSmtpIdleTtlMs();
  for (const [key, entry] of transporterPools) {
    if (now - entry.lastUsed < idleTtlMs) continue;
    void entry.transporter.close();
    transporterPools.delete(key);
  }

  const maxPools = getSmtpMaxPools();
  if (transporterPools.size <= maxPools) return;

  const sorted = [...transporterPools.entries()].sort(
    (a, b) => a[1].lastUsed - b[1].lastUsed,
  );
  for (const [key, entry] of sorted.slice(
    0,
    transporterPools.size - maxPools,
  )) {
    void entry.transporter.close();
    transporterPools.delete(key);
  }
}

function ensureSweeper(): void {
  if (sweeper) return;
  sweeper = setInterval(() => {
    evictIdlePools();
  }, getSmtpIdleTtlMs());
  sweeper.unref();
}

export function getTransporter(creds: SmtpCredentials): Transporter {
  ensureSweeper();
  const key = credentialFingerprint(creds);
  const existing = transporterPools.get(key);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.transporter;
  }

  evictIdlePools();
  const transporter = createPooledTransporter(creds);
  transporterPools.set(key, { transporter, lastUsed: Date.now() });
  return transporter;
}

export async function closeAllTransporters(): Promise<void> {
  if (sweeper) {
    clearInterval(sweeper);
    sweeper = undefined;
  }

  const closers = [...transporterPools.values()].map((entry) =>
    entry.transporter.close(),
  );
  transporterPools.clear();
  await Promise.allSettled(closers);
}

/** Test helper — resets module state between unit tests. */
export async function resetTransporterPoolForTests(): Promise<void> {
  await closeAllTransporters();
}

export async function sendEmail(
  creds: SmtpCredentials,
  email: OutboundEmail,
  context?: { projectId?: string },
): Promise<string> {
  const transporter = getTransporter(creds);

  const domain =
    parseMailFromAddress(creds.smtpFrom).split("@")[1] ?? "servicebeard.local";
  const messageId = `<${randomBytes(16).toString("hex")}@${domain}>`;
  const inReplyTo = email.inReplyTo
    ? normalizeMessageId(email.inReplyTo)
    : undefined;
  const references = (email.references ?? []).map(normalizeMessageId);

  try {
    await transporter.sendMail({
      from: creds.smtpFrom,
      to: email.toName ? `"${email.toName}" <${email.to}>` : email.to,
      cc: email.cc,
      subject: email.subject.startsWith("Re:")
        ? email.subject
        : `Re: ${email.subject}`,
      text: email.body,
      html: email.bodyHtml,
      attachments: email.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        cid: attachment.cid,
        contentDisposition: "inline" as const,
      })),
      messageId,
      inReplyTo,
      references: references.length > 0 ? references.join(" ") : undefined,
    });
  } catch (err) {
    logExternalError("smtp", "send-mail", err, {
      projectId: context?.projectId,
      host: creds.smtpHost,
      port: creds.smtpPort,
      to: email.to,
      subject: email.subject,
    });
    throw err;
  }

  return messageId;
}
