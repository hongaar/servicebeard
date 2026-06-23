import type { emailMessages, issueThreads, projects } from "@serviceboard/db";
import {
    buildReferencesChain,
    formatMailboxAddress,
    formatQuotedReply,
    normalizeMessageId,
    parseMailFromAddress,
    supportMailboxCc,
    type QuotedEmail,
} from "@serviceboard/shared";
import type { ParsedEmail } from "./rules";

type StoredEmailMessage = typeof emailMessages.$inferSelect;
type IssueThread = typeof issueThreads.$inferSelect;

export function sortThreadMessages(
  messages: StoredEmailMessage[],
): StoredEmailMessage[] {
  return [...messages].sort(
    (a, b) => a.processedAt.getTime() - b.processedAt.getTime(),
  );
}

export function latestThreadMessage(
  messages: StoredEmailMessage[],
): StoredEmailMessage | undefined {
  const sorted = sortThreadMessages(messages);
  return sorted[sorted.length - 1];
}

export function quotedEmailFromParsed(email: ParsedEmail): QuotedEmail {
  return {
    fromName: email.fromName,
    fromEmail: email.fromEmail,
    date: email.date,
    body: email.body,
  };
}

export function quotedEmailFromStored(
  message: StoredEmailMessage,
  thread: IssueThread,
  smtpFrom: string,
): QuotedEmail {
  if (message.direction === "inbound") {
    return {
      fromName: thread.originalSenderName,
      fromEmail: thread.originalSenderEmail,
      date: message.processedAt,
      body: message.bodyText ?? "",
    };
  }

  return {
    fromName: null,
    fromEmail: parseMailFromAddress(smtpFrom),
    date: message.processedAt,
    body: message.bodyText ?? "",
  };
}

export function threadingForParent(parentMessageId: string, parentReferences: string[]) {
  const inReplyTo = normalizeMessageId(parentMessageId);
  const references = buildReferencesChain(parentReferences, parentMessageId);
  return { inReplyTo, references };
}

export function customerOutboundCc(
  project: typeof projects.$inferSelect,
  customerEmail: string,
): string | undefined {
  return supportMailboxCc(project.smtpFrom, customerEmail);
}

export function outboundEmailAddresses(
  smtpFrom: string,
  toEmail: string,
  toName: string | null,
  cc?: string | string[],
) {
  return {
    fromAddress: smtpFrom,
    toAddresses: [formatMailboxAddress(toEmail, toName)],
    ccAddresses: cc ? (Array.isArray(cc) ? cc : [cc]) : [],
    bccAddresses: [] as string[],
  };
}

export function inboundEmailAddresses(email: ParsedEmail) {
  return {
    fromAddress: formatMailboxAddress(email.fromEmail, email.fromName),
    toAddresses: email.toAddresses,
    ccAddresses: email.ccAddresses,
    bccAddresses: email.bccAddresses,
  };
}

export function replyBodyWithQuote(
  replyText: string,
  quoted: QuotedEmail,
): string {
  if (!quoted.body.trim()) return replyText.trim();
  return formatQuotedReply(replyText, quoted);
}
