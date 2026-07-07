import { resolveInboundSender } from "../mail";
import type { ParsedEmail } from "../rules";
import type { Rule } from "../types";

export const testEmailDate = new Date("2026-01-15T12:00:00Z");

type TestEmailInput = Omit<
  ParsedEmail,
  | "bodyMarkdown"
  | "bodyHtml"
  | "inlineImages"
  | "senderEmail"
  | "senderName"
  | "replyToEmail"
  | "replyToName"
> & {
  senderEmail?: string;
  senderName?: string | null;
  replyToEmail?: string | null;
  replyToName?: string | null;
  bodyMarkdown?: string;
  bodyHtml?: string | null;
  inlineImages?: ParsedEmail["inlineImages"];
};

export function testEmail(overrides: TestEmailInput): ParsedEmail {
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

  const {
    bodyMarkdown: bodyMarkdownOverride,
    bodyHtml: bodyHtmlOverride,
    inlineImages: inlineImagesOverride,
    senderEmail: senderEmailOverride,
    senderName: senderNameOverride,
    ...rest
  } = overrides;

  return {
    ...rest,
    replyToEmail,
    replyToName,
    bodyMarkdown: bodyMarkdownOverride ?? overrides.body,
    bodyHtml: bodyHtmlOverride ?? null,
    inlineImages: inlineImagesOverride ?? [],
    senderEmail: senderEmailOverride ?? sender.email,
    senderName: senderNameOverride ?? sender.name,
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
