import { markdownToHtml, markdownToPlainText } from "./email-content";

export const DEFAULT_INBOUND_ACK_TEMPLATE = `Thank you for contacting us.

We have received your email regarding **"{{subject}}"** and created issue **#{{issueNumber}}** for our team to review. We will follow up with you soon.

Reference: {{issueUrl}}`;

export const DEFAULT_OUTBOUND_COMMENT_TEMPLATE = `{{commentBody}}

---
Reply from {{authorName}} on issue #{{issueNumber}}
{{issueUrl}}`;

export const DEFAULT_INBOUND_ISSUE_TEMPLATE = `**Message from {{sender}}**

{{body}}`;

export const DEFAULT_INBOUND_COMMENT_TEMPLATE = `**Reply from {{sender}}**

{{body}}`;

export const INBOUND_ACK_TEMPLATE_VARIABLES = [
  "senderName",
  "senderEmail",
  "subject",
  "issueNumber",
  "issueUrl",
] as const;

export const OUTBOUND_COMMENT_TEMPLATE_VARIABLES = [
  "commentBody",
  "authorName",
  "issueNumber",
  "issueUrl",
] as const;

export const INBOUND_ISSUE_TEMPLATE_VARIABLES = [
  "sender",
  "senderName",
  "senderEmail",
  "subject",
  "body",
] as const;

export const INBOUND_COMMENT_TEMPLATE_VARIABLES = [
  "sender",
  "senderName",
  "senderEmail",
  "body",
] as const;

/** Sample values for template preview in the UI. */
export const TEMPLATE_PREVIEW_VALUES: Record<string, string> = {
  senderName: "Jane Customer",
  senderEmail: "jane@example.com",
  sender: "Jane Customer <jane@example.com>",
  subject: "Help with my order",
  issueNumber: "42",
  issueUrl: "https://gitlab.example.com/issues/42",
  commentBody:
    "Thanks for your patience — we shipped a fix and it should be live now.",
  authorName: "Alex Support",
  body: "Hi, I'm having trouble with my recent order. Could you help?",
};

export function templatePreviewVariables(
  variableNames: readonly string[],
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const name of variableNames) {
    vars[name] = TEMPLATE_PREVIEW_VALUES[name] ?? name;
  }
  return vars;
}

export interface InboundAckTemplateVars {
  senderName: string;
  senderEmail: string;
  subject: string;
  issueNumber: number;
  issueUrl: string;
}

export interface OutboundCommentTemplateVars {
  commentBody: string;
  authorName: string;
  issueNumber: number;
  issueUrl: string;
}

export interface InboundIssueTemplateVars {
  sender: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
}

export interface InboundCommentTemplateVars {
  sender: string;
  senderName: string;
  senderEmail: string;
  body: string;
}

export function formatEmailSender(
  fromName: string | null,
  fromEmail: string,
): string {
  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
}

export function renderTemplate(
  template: string,
  vars: Record<string, string | number> | object,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (key in vars) {
      return String((vars as Record<string, string | number>)[key]);
    }
    return match;
  });
}

export function renderInboundAckTemplate(
  template: string,
  vars: InboundAckTemplateVars,
): string {
  return renderTemplate(template, vars);
}

export function renderOutboundCommentTemplate(
  template: string,
  vars: OutboundCommentTemplateVars,
): string {
  return renderTemplate(template, vars);
}

export function renderInboundIssueTemplate(
  template: string,
  vars: InboundIssueTemplateVars,
): string {
  return renderTemplate(template, vars);
}

export function renderInboundCommentTemplate(
  template: string,
  vars: InboundCommentTemplateVars,
): string {
  return renderTemplate(template, vars);
}

/** Markdown email body as multipart plain text and HTML parts. */
export function buildMarkdownEmailParts(markdown: string): {
  text: string;
  html: string;
} {
  return {
    text: markdownToPlainText(markdown),
    html: markdownToHtml(markdown),
  };
}
