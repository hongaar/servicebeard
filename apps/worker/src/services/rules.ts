import type { ParsedEmail, ProviderType } from "@servicebeard/shared";
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
    sender: formatEmailSender(email.senderName, email.senderEmail),
    senderName: email.senderName ?? email.senderEmail,
    senderEmail: email.senderEmail,
    subject: email.subject,
    body,
  });
  const supportFooter = support ? buildIssueSupportDetailsFooter(support) : "";

  return `${rendered}${supportFooter ? `\n${supportFooter}\n` : "\n"}${buildSyncMarker(threadId, support?.provider)}`;
}

export function formatCommentBody(
  email: ParsedEmail,
  template: string,
  bodyMarkdown?: string,
  provider?: ProviderType | string,
): string {
  const body = stripQuotedReply(bodyMarkdown ?? email.bodyMarkdown ?? email.body);
  const rendered = renderInboundCommentTemplate(template, {
    sender: formatEmailSender(email.senderName, email.senderEmail),
    senderName: email.senderName ?? email.senderEmail,
    senderEmail: email.senderEmail,
    body,
  });

  return `${rendered}\n\n${buildSyncMarker(`email:${email.messageId}`, provider)}`;
}
