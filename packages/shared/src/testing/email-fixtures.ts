import { resolveInboundSender } from "../mail";
import type { ParsedEmail, Rule } from "../types";

export const testEmailDate = new Date("2026-01-15T12:00:00Z");

export function testEmail(
  overrides: Omit<ParsedEmail, "bodyMarkdown" | "bodyHtml" | "inlineImages"> & {
    bodyMarkdown?: string;
    bodyHtml?: string | null;
    inlineImages?: ParsedEmail["inlineImages"];
  },
): ParsedEmail {
  const fromEmail = overrides.fromEmail;
  const fromName = overrides.fromName ?? null;
  const replyToEmail = overrides.replyToEmail ?? null;
  const replyToName = overrides.replyToName ?? null;
  const sender = resolveInboundSender(
    fromEmail,
    fromName,
    replyToEmail,
    replyToName,
  );

  return {
    bodyMarkdown: overrides.bodyMarkdown ?? overrides.body,
    bodyHtml: overrides.bodyHtml ?? null,
    inlineImages: overrides.inlineImages ?? [],
    replyToEmail,
    replyToName,
    senderEmail: overrides.senderEmail ?? sender.email,
    senderName: overrides.senderName ?? sender.name,
    ...overrides,
  };
}

export const baseRule: Rule = {
  id: "1",
  projectId: "p1",
  name: "Support",
  priority: 0,
  isEnabled: true,
  matchSender: "support@example.com",
  matchSubject: null,
  matchBody: null,
  actionCreateIssue: true,
  actionStatus: null,
  actionLabels: ["support"],
  actionAssigneeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
