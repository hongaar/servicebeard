import {
  firstMailboxAddress,
  formatMailboxAddress,
  normalizeMessageId,
  optionalMailboxAddress,
  resolveInboundSender,
} from "@servicebeard/shared";
import { buildParsedEmailContent } from "@servicebeard/shared/email-content";
import { ImapFlow } from "imapflow";
import type { AddressObject } from "mailparser";
import { simpleParser } from "mailparser";
import { logExternalError } from "../lib/external-error";
import type { ParsedEmail } from "./rules";

function addressesFromField(field?: AddressObject | AddressObject[]): string[] {
  if (!field) return [];
  const items = Array.isArray(field) ? field : [field];
  return items.flatMap((item) =>
    item.value
      .map((entry) =>
        entry.address ? formatMailboxAddress(entry.address, entry.name) : null,
      )
      .filter((value): value is string => Boolean(value)),
  );
}

export interface MailCredentials {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPassword: string;
}

export interface InboxFetchResult {
  messages: Array<{ uid: number; raw: Buffer; internalDate: Date }>;
  /** Latest IMAP internal date among all messages in the search window. */
  scannedThrough: Date | null;
}

function createImapClient(creds: MailCredentials): ImapFlow {
  return new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapSecure,
    auth: { user: creds.imapUser, pass: creds.imapPassword },
    logger: false,
  });
}

function parseImapInternalDate(value: Date | string | undefined): Date {
  if (value instanceof Date) return value;
  if (value) return new Date(value);
  return new Date();
}

function laterDate(a: Date | null, b: Date): Date {
  if (!a) return b;
  return b.getTime() > a.getTime() ? b : a;
}

/** Fetches inbox messages on or after `since`, skipping IDs already ingested by the project. */
export async function fetchInboxMessagesSince(
  creds: MailCredentials,
  since: Date,
  skipMessageIds: ReadonlySet<string>,
  _context?: { projectId?: string },
): Promise<InboxFetchResult> {
  const client = createImapClient(creds);
  const messages: InboxFetchResult["messages"] = [];
  let scannedThrough: Date | null = null;

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  try {
    const uids = await client.search({ since }, { uid: true });
    if (!uids || uids.length === 0) {
      return { messages, scannedThrough };
    }

    const pendingUids: number[] = [];

    for await (const msg of client.fetch(
      uids,
      { envelope: true, uid: true, internalDate: true },
      { uid: true },
    )) {
      if (!msg.uid) continue;
      const internalDate = parseImapInternalDate(msg.internalDate);
      scannedThrough = laterDate(scannedThrough, internalDate);

      const envelopeId = msg.envelope?.messageId?.trim();
      if (!envelopeId) {
        pendingUids.push(msg.uid);
        continue;
      }
      const messageId = normalizeMessageId(envelopeId);
      if (!skipMessageIds.has(messageId)) {
        pendingUids.push(msg.uid);
      }
    }

    if (pendingUids.length === 0) {
      return { messages, scannedThrough };
    }

    for await (const msg of client.fetch(
      pendingUids,
      { source: true, uid: true, internalDate: true },
      { uid: true },
    )) {
      if (!msg.source || !msg.uid) continue;
      messages.push({
        uid: msg.uid,
        raw: msg.source,
        internalDate: parseImapInternalDate(msg.internalDate),
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return { messages, scannedThrough };
}

export async function markMessageSeen(
  creds: MailCredentials,
  uid: number,
  context?: { projectId?: string },
): Promise<void> {
  const client = createImapClient(creds);

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (err) {
    logExternalError("imap", "mark-seen", err, {
      projectId: context?.projectId,
      host: creds.imapHost,
      port: creds.imapPort,
      user: creds.imapUser,
      uid,
    });
    throw err;
  }
}

export async function parseEmail(
  raw: Buffer,
  internalDate?: Date,
): Promise<ParsedEmail> {
  const parsed = await simpleParser(raw);

  const messageId = normalizeMessageId(
    parsed.messageId ?? `generated-${Date.now()}@servicebeard.local`,
  );
  const inReplyTo = parsed.inReplyTo
    ? normalizeMessageId(parsed.inReplyTo)
    : null;
  const references = (
    Array.isArray(parsed.references)
      ? parsed.references
      : parsed.references
        ? [parsed.references]
        : []
  ).map(normalizeMessageId);

  const from = firstMailboxAddress(parsed.from);
  const replyTo = optionalMailboxAddress(parsed.replyTo);
  const sender = resolveInboundSender(
    from.email,
    from.name,
    replyTo?.email ?? null,
    replyTo?.name ?? null,
  );

  const subject = parsed.subject ?? "(no subject)";
  const content = buildParsedEmailContent(
    parsed.text,
    parsed.html,
    (parsed.attachments ?? []).map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      content: a.content,
      cid: a.cid,
    })),
  );

  return {
    messageId,
    inReplyTo,
    references,
    fromEmail: from.email,
    fromName: from.name,
    replyToEmail: replyTo?.email ?? null,
    replyToName: replyTo?.name ?? null,
    senderEmail: sender.email,
    senderName: sender.name,
    toAddresses: addressesFromField(parsed.to),
    ccAddresses: addressesFromField(parsed.cc),
    bccAddresses: addressesFromField(parsed.bcc),
    subject,
    body: content.body,
    bodyMarkdown: content.bodyMarkdown,
    bodyHtml: content.bodyHtml,
    inlineImages: content.inlineImages,
    date: parsed.date ?? internalDate ?? new Date(),
  };
}
