import { formatMailboxAddress, normalizeMessageId } from "@serviceboard/shared";
import { buildParsedEmailContent } from "@serviceboard/shared/email-content";
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

export async function fetchUnseenMessages(
  creds: MailCredentials,
): Promise<Array<{ uid: number; raw: Buffer; internalDate: Date }>> {
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapSecure,
    auth: { user: creds.imapUser, pass: creds.imapPassword },
    logger: false,
  });

  const messages: Array<{ uid: number; raw: Buffer; internalDate: Date }> = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      for await (const msg of client.fetch(
        { seen: false },
        { source: true, uid: true, internalDate: true },
      )) {
        if (msg.source && msg.uid) {
          const internalDate =
            msg.internalDate instanceof Date
              ? msg.internalDate
              : msg.internalDate
                ? new Date(msg.internalDate)
                : new Date();
          messages.push({ uid: msg.uid, raw: msg.source, internalDate });
        }
      }
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (err) {
    logExternalError("imap", "fetch-unseen", err, {
      host: creds.imapHost,
      port: creds.imapPort,
      user: creds.imapUser,
    });
    throw err;
  }

  return messages;
}

export async function markMessageSeen(
  creds: MailCredentials,
  uid: number,
): Promise<void> {
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapSecure,
    auth: { user: creds.imapUser, pass: creds.imapPassword },
    logger: false,
  });

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
    parsed.messageId ?? `generated-${Date.now()}@serviceboard.local`,
  );
  const inReplyTo = parsed.inReplyTo ? normalizeMessageId(parsed.inReplyTo) : null;
  const references = (Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? [parsed.references]
      : []
  ).map(normalizeMessageId);

  const from = parsed.from?.value[0];
  const fromEmail = from?.address ?? "unknown@unknown.local";
  const fromName = from?.name?.trim() || null;

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
    fromEmail,
    fromName,
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
