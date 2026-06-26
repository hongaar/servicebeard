import type { InboundMailboxContext } from "./inbound-mail";
import { isEligibleForInboundRuleEvaluation } from "./inbound-mail";
import type { EmailInlineImage, Rule } from "./types";

export interface ParsedEmail {
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  fromEmail: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string;
  /** Plain text for rule matching, quoting, and storage. */
  body: string;
  /** Markdown for issue tracker comments (may contain unresolved cid: image refs). */
  bodyMarkdown: string;
  bodyHtml: string | null;
  inlineImages: EmailInlineImage[];
  date: Date;
}

export interface RuleMatchResult {
  matched: boolean;
  rule: Rule | null;
}

export interface RuleTestInput {
  matchSender?: string | null;
  matchSubject?: string | null;
  matchBody?: string | null;
  isEnabled?: boolean;
}

function testPattern(pattern: string | null | undefined, value: string): boolean {
  if (!pattern) return true;
  try {
    return new RegExp(pattern, "i").test(value);
  } catch {
    return value.toLowerCase().includes(pattern.toLowerCase());
  }
}

export function evaluateRule(rule: RuleTestInput, email: ParsedEmail): boolean {
  if (rule.isEnabled === false) return false;
  const senderMatch = testPattern(rule.matchSender ?? null, email.fromEmail);
  const subjectMatch = testPattern(rule.matchSubject ?? null, email.subject);
  const bodyMatch = testPattern(rule.matchBody ?? null, email.body);
  return senderMatch && subjectMatch && bodyMatch;
}

export function evaluateRules(rules: Rule[], email: ParsedEmail): RuleMatchResult {
  const enabled = rules
    .filter((r) => r.isEnabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of enabled) {
    if (evaluateRule(rule, email)) {
      return { matched: true, rule };
    }
  }

  return { matched: false, rule: null };
}

export function evaluateDraftRule(rule: RuleTestInput, email: ParsedEmail): boolean {
  return evaluateRule({ ...rule, isEnabled: rule.isEnabled ?? true }, email);
}

export function evaluateDraftRuleForInbound(
  rule: RuleTestInput,
  email: ParsedEmail,
  ctx: InboundMailboxContext,
): boolean {
  if (!isEligibleForInboundRuleEvaluation(email, ctx)) return false;
  return evaluateDraftRule(rule, email);
}
