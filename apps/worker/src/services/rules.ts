import type { ParsedEmail } from "@servicebeard/shared";
import {
    buildIssueSupportDetailsFooter,
    buildSyncMarker,
    formatEmailSender,
    renderInboundCommentTemplate,
    renderInboundIssueTemplate,
    stripQuotedReply,
    type IssueSupportDetailsOptions,
    type RuleMatchResult,
} from "@servicebeard/shared";

export { evaluateRules } from "@servicebeard/shared";
export type { ParsedEmail, RuleMatchResult };

export function formatIssueDescription(
  email: ParsedEmail,
  threadId: string,
  template: string,
  bodyMarkdown?: string,
  support?: IssueSupportDetailsOptions,
): string {
  const body = bodyMarkdown ?? email.bodyMarkdown ?? email.body;
  const rendered = renderInboundIssueTemplate(template, {
    sender: formatEmailSender(email.fromName, email.fromEmail),
    senderName: email.fromName ?? email.fromEmail,
    senderEmail: email.fromEmail,
    subject: email.subject,
    body,
  });
  const supportFooter = support ? buildIssueSupportDetailsFooter(support) : "";

  return `${rendered}${supportFooter ? `\n${supportFooter}\n` : "\n"}${buildSyncMarker(threadId)}`;
}

export function formatCommentBody(
  email: ParsedEmail,
  template: string,
  bodyMarkdown?: string,
): string {
  const body = stripQuotedReply(bodyMarkdown ?? email.bodyMarkdown ?? email.body);
  const rendered = renderInboundCommentTemplate(template, {
    sender: formatEmailSender(email.fromName, email.fromEmail),
    senderName: email.fromName ?? email.fromEmail,
    senderEmail: email.fromEmail,
    body,
  });

  return `${rendered}\n\n${buildSyncMarker(`email:${email.messageId}`)}`;
}
