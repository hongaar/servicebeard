import type { ParsedEmail } from "@serviceboard/shared";
import { evaluateRules, stripQuotedReply, type RuleMatchResult } from "@serviceboard/shared";

export { evaluateRules };
export type { ParsedEmail, RuleMatchResult };

export function formatIssueDescription(
  email: ParsedEmail,
  threadId: string,
  bodyMarkdown?: string,
): string {
  const sender = email.fromName
    ? `${email.fromName} <${email.fromEmail}>`
    : email.fromEmail;

  const body = bodyMarkdown ?? email.bodyMarkdown ?? email.body;

  return `${body}

---
**Email metadata**
- From: ${sender}
- Subject: ${email.subject}
- Message-ID: ${email.messageId}
<!-- serviceboard-sync:${threadId} -->`;
}

export function formatCommentBody(
  email: ParsedEmail,
  bodyMarkdown?: string,
): string {
  const sender = email.fromName
    ? `${email.fromName} <${email.fromEmail}>`
    : email.fromEmail;

  const body = stripQuotedReply(bodyMarkdown ?? email.bodyMarkdown ?? email.body);

  return `**Reply from ${sender}**

${body}`;
}
