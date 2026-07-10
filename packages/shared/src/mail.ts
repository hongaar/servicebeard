import { z } from "zod";
import {
  containsQuoteAttribution,
  findQuoteReplyCutIndex,
} from "./email-reply-markers";

/** Accepts `user@host`, `user@localhost`, and `Name <user@host>`. */
const MAILBOX_ADDR = /^[^\s@]+@[^\s@]+$/;
const MAIL_FROM_WITH_NAME = /^(.+?)\s+<([^<>]+)>$/;

export function isValidMailFrom(value: string): boolean {
  const trimmed = value.trim();
  const named = trimmed.match(MAIL_FROM_WITH_NAME);
  const addr = named ? named[2].trim() : trimmed;
  return MAILBOX_ADDR.test(addr);
}

export function parseMailFromAddress(value: string): string {
  const trimmed = value.trim();
  const named = trimmed.match(MAIL_FROM_WITH_NAME);
  return named ? named[2].trim() : trimmed;
}

export function parseMailFromName(value: string): string | null {
  const trimmed = value.trim();
  const named = trimmed.match(MAIL_FROM_WITH_NAME);
  const name = named?.[1]?.trim();
  return name || null;
}

export function formatMailFrom(email: string, name?: string | null): string {
  return formatMailboxAddress(email.trim(), name?.trim() || null);
}

export function formatMailboxAddress(
  email: string,
  name?: string | null,
): string {
  const trimmedName = name?.trim();
  if (trimmedName) return `${trimmedName} <${email}>`;
  return email;
}

export interface MailboxAddress {
  email: string;
  name: string | null;
}

/** First address from a mailparser address field (`from`, `replyTo`, etc.). */
export function firstMailboxAddress(
  field?: { value: Array<{ address?: string; name?: string }> } | null,
): MailboxAddress {
  const entry = field?.value[0];
  return {
    email: entry?.address?.trim() || "unknown@unknown.local",
    name: entry?.name?.trim() || null,
  };
}

/** Like firstMailboxAddress but returns null when the field is absent or empty. */
export function optionalMailboxAddress(
  field?: { value: Array<{ address?: string; name?: string }> } | null,
): MailboxAddress | null {
  const entry = field?.value[0];
  const email = entry?.address?.trim();
  if (!email) return null;
  return { email, name: entry?.name?.trim() || null };
}

/**
 * Customer-facing sender for inbound sync. Prefers Reply-To over From so
 * relayed mail (e.g. contact forms) routes replies to the real customer.
 */
export function resolveInboundSender(
  fromEmail: string,
  fromName: string | null,
  replyToEmail: string | null,
  replyToName: string | null,
): MailboxAddress {
  if (replyToEmail) {
    return {
      email: replyToEmail,
      name: replyToName,
    };
  }
  return { email: fromEmail, name: fromName };
}

export function formatAddressList(addresses: string[]): string {
  return addresses.length > 0 ? addresses.join(", ") : "—";
}

/** Ensures RFC 5322 angle-bracket form for Message-ID / In-Reply-To values. */
export function normalizeMessageId(messageId: string): string {
  const trimmed = messageId.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed;
  const inner = trimmed.replace(/^<|>$/g, "");
  return `<${inner}>`;
}

/** Builds a References chain ending with the direct parent message. */
export function buildReferencesChain(
  priorReferences: string[],
  parentMessageId: string,
): string[] {
  const chain = priorReferences.map(normalizeMessageId);
  const parent = normalizeMessageId(parentMessageId);
  if (!chain.includes(parent)) chain.push(parent);
  return chain;
}

export function supportMailboxCc(
  smtpFrom: string,
  customerEmail: string,
): string | undefined {
  const support = parseMailFromAddress(smtpFrom);
  return support.toLowerCase() !== customerEmail.toLowerCase()
    ? support
    : undefined;
}

export interface QuotedEmail {
  fromName: string | null;
  fromEmail: string;
  date: Date;
  body: string;
}

export function formatQuoteAttributionLine(quoted: QuotedEmail): string {
  const sender = quoted.fromName
    ? `${quoted.fromName} <${quoted.fromEmail}>`
    : quoted.fromEmail;
  const dateStr = quoted.date.toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `On ${dateStr}, ${sender} wrote:`;
}

export function formatQuotedReply(
  replyText: string,
  quoted: QuotedEmail,
): string {
  const quotedBody = quoted.body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  return `${replyText.trim()}

${formatQuoteAttributionLine(quoted)}

${quotedBody}`;
}

function stripTrailingQuotedLines(body: string): string {
  const lines = body.split("\n");
  let cut = lines.length;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      cut = index;
      continue;
    }
    if (/^>+/.test(line.trim())) {
      cut = index;
      continue;
    }
    break;
  }

  return lines.slice(0, cut).join("\n").trimEnd();
}

function hasQuoteLeak(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;

  return (
    /\n>/.test(trimmed) ||
    /^>/.test(trimmed) ||
    containsQuoteAttribution(trimmed) ||
    /Reply from .+/i.test(trimmed) ||
    /Thank you for contacting us/i.test(trimmed)
  );
}

/** Strips quoted reply history from plain-text bodies (for issue tracker comments). */
export function stripQuotedReply(body: string): string {
  const normalized = body.replace(/\r\n/g, "\n");
  const cutAt = findQuoteReplyCutIndex(normalized);
  return stripTrailingQuotedLines(normalized.slice(0, cutAt));
}

/** Picks the cleanest stripped reply body from multipart or derived candidates. */
export function pickStrippedReplyBody(
  ...candidates: Array<string | undefined | null>
): string {
  const seen = new Set<string>();
  const stripped: string[] = [];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);

    const result = stripQuotedReply(trimmed);
    if (result.trim()) stripped.push(result);
  }

  if (stripped.length === 0) return "";

  for (let i = 0; i < stripped.length; i += 1) {
    for (let j = 0; j < stripped.length; j += 1) {
      if (i === j) continue;
      const longer = stripped[i]!;
      const shorter = stripped[j]!;
      if (shorter.length >= longer.length - 20) continue;
      if (!hasQuoteLeak(longer)) continue;

      const opening = shorter.split("\n\n")[0]?.trim();
      if (opening && longer.startsWith(opening)) return shorter;
    }
  }

  const clean = stripped.filter((body) => !hasQuoteLeak(body));
  if (clean.length > 0) return clean[0]!;

  return stripped.reduce((best, current) =>
    current.length < best.length ? current : best,
  );
}

export const mailFromSchema = z.string().min(3).refine(isValidMailFrom, {
  message: "Invalid From address (use user@host or Name <user@host>)",
});
