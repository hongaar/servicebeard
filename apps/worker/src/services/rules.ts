import type { ParsedEmail } from "@servicebeard/shared";
import {
    buildSyncMarker,
    evaluateRules,
    stripQuotedReply,
    type RuleMatchResult,
} from "@servicebeard/shared";

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

  return `**Message from ${sender}**

${body}

${buildSyncMarker(threadId)}`;
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

${body}

${buildSyncMarker(`email:${email.messageId}`)}`;
}
