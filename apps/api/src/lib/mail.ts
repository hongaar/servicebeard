import type { ParsedEmail } from "@servicebeard/shared";
import { formatMailboxAddress } from "@servicebeard/shared";
import { buildParsedEmailContent } from "@servicebeard/shared/email-content";
import { ImapFlow } from "imapflow";
import type { AddressObject } from "mailparser";
import { simpleParser } from "mailparser";

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

export async function fetchRecentMessages(
  creds: MailCredentials,
  limit = 20,
): Promise<Array<{ uid: number; raw: Buffer }>> {
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapSecure,
    auth: { user: creds.imapUser, pass: creds.imapPassword },
    logger: false,
  });

  const messages: Array<{ uid: number; raw: Buffer }> = [];

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  try {
    const mailbox = client.mailbox;
    const total = mailbox && typeof mailbox === "object" ? mailbox.exists : 0;
    if (total === 0) return messages;

    const start = Math.max(1, total - limit + 1);
    const range = `${start}:*`;

    for await (const msg of client.fetch(range, { source: true, uid: true })) {
      if (msg.source && msg.uid) {
        messages.push({ uid: msg.uid, raw: msg.source });
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return messages.reverse();
}

export async function parseEmail(raw: Buffer): Promise<ParsedEmail> {
  const parsed = await simpleParser(raw);

  const messageId = parsed.messageId ?? `generated-${Date.now()}@servicebeard.local`;
  const inReplyTo = parsed.inReplyTo ?? null;
  const references = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? [parsed.references]
      : [];

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
    date: parsed.date ?? new Date(0),
  };
}
