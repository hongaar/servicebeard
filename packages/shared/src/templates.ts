export const DEFAULT_INBOUND_ACK_TEMPLATE = `Thank you for contacting us.

We have received your email regarding "{{subject}}" and created issue #{{issueNumber}} for our team to review. We will follow up with you soon.

Reference: {{issueUrl}}`;

export const INBOUND_ACK_TEMPLATE_VARIABLES = [
  "senderName",
  "senderEmail",
  "subject",
  "issueNumber",
  "issueUrl",
] as const;

export interface InboundAckTemplateVars {
  senderName: string;
  senderEmail: string;
  subject: string;
  issueNumber: number;
  issueUrl: string;
}

export function renderInboundAckTemplate(
  template: string,
  vars: InboundAckTemplateVars,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (key in vars) {
      return String(vars[key as keyof InboundAckTemplateVars]);
    }
    return match;
  });
}
