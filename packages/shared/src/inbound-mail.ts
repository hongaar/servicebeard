import { isReplySubject, normalizeSubject } from "./constants";
import { parseMailFromAddress } from "./mail";

/** Max age for subject-based thread matching when In-Reply-To/References are absent. */
export const SUBJECT_THREAD_MATCH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface InboundMailboxContext {
  supportEmail: string;
  projectCreatedAt?: Date;
}

export interface InboundEmailEligibility {
  fromEmail: string;
  /** Customer address for threading; defaults to fromEmail when omitted. */
  senderEmail?: string;
  subject: string;
  inReplyTo: string | null;
  references: string[];
  date: Date;
}

function effectiveSenderEmail(email: {
  fromEmail: string;
  senderEmail?: string;
}): string {
  return email.senderEmail ?? email.fromEmail;
}

export interface ThreadMatchIndex {
  storedMessageIds: ReadonlySet<string>;
  storedInReplyTos: ReadonlySet<string>;
  /** subject+sender key → last activity time for freshness checks */
  subjectThreadActivity: ReadonlyMap<string, Date>;
}

export function subjectSenderThreadKey(
  subjectNormalized: string,
  senderEmail: string,
): string {
  return `${subjectNormalized}\0${senderEmail.toLowerCase()}`;
}

export function isSubjectThreadMatchFresh(
  lastActivityAt: Date,
  at: Date = new Date(),
  maxAgeMs: number = SUBJECT_THREAD_MATCH_MAX_AGE_MS,
): boolean {
  return at.getTime() - lastActivityAt.getTime() <= maxAgeMs;
}

/** Only process emails sent on or after the project was created. */
export function isEmailEligibleForInboundSync(
  emailDate: Date,
  projectCreatedAt: Date,
): boolean {
  return emailDate.getTime() >= projectCreatedAt.getTime();
}

export function normalizeMailboxEmail(address: string): string {
  return parseMailFromAddress(address).toLowerCase();
}

export function isEmailFromSupportMailbox(
  supportEmail: string,
  fromEmail: string,
): boolean {
  return (
    normalizeMailboxEmail(fromEmail) === normalizeMailboxEmail(supportEmail)
  );
}

/**
 * Envelope From is the support mailbox but the customer address is elsewhere
 * (typically Reply-To), e.g. contact-form relay or helpdesk send-on-behalf.
 */
export function isRelayedInboundMail(
  supportEmail: string,
  email: { fromEmail: string; senderEmail?: string },
): boolean {
  if (!isEmailFromSupportMailbox(supportEmail, email.fromEmail)) {
    return false;
  }
  return !isEmailFromSupportMailbox(supportEmail, effectiveSenderEmail(email));
}

export function buildThreadMatchIndex(
  storedMessages: Array<{ messageId: string; inReplyTo: string | null }>,
  threads: Array<{
    subjectNormalized: string;
    originalSenderEmail: string;
    lastActivityAt: Date;
  }>,
): ThreadMatchIndex {
  const subjectThreadActivity = new Map<string, Date>();
  for (const thread of threads) {
    const key = subjectSenderThreadKey(
      thread.subjectNormalized,
      thread.originalSenderEmail,
    );
    const existing = subjectThreadActivity.get(key);
    if (!existing || thread.lastActivityAt.getTime() > existing.getTime()) {
      subjectThreadActivity.set(key, thread.lastActivityAt);
    }
  }

  return {
    storedMessageIds: new Set(
      storedMessages.map((message) => message.messageId),
    ),
    storedInReplyTos: new Set(
      storedMessages
        .map((message) => message.inReplyTo)
        .filter((value): value is string => Boolean(value)),
    ),
    subjectThreadActivity,
  };
}

/** Mirrors worker thread detection for rule preview and testing. */
export function emailMatchesExistingThread(
  email: Pick<
    InboundEmailEligibility,
    "inReplyTo" | "references" | "subject" | "fromEmail" | "senderEmail"
  >,
  index: ThreadMatchIndex,
  at: Date = new Date(),
): boolean {
  const refIds = [
    ...(email.inReplyTo ? [email.inReplyTo] : []),
    ...email.references,
  ];

  for (const ref of refIds) {
    if (index.storedMessageIds.has(ref) || index.storedInReplyTos.has(ref)) {
      return true;
    }
  }

  if (!isReplySubject(email.subject)) {
    return false;
  }

  const subjectSenderKey = subjectSenderThreadKey(
    normalizeSubject(email.subject),
    effectiveSenderEmail(email),
  );
  const lastActivityAt = index.subjectThreadActivity.get(subjectSenderKey);
  if (!lastActivityAt) {
    return false;
  }
  return isSubjectThreadMatchFresh(lastActivityAt, at);
}

/**
 * Mail that can create a new issue via routing rules — excludes copies sent by the
 * support mailbox and pre-project messages. Relayed mail (support From + external
 * Reply-To sender) is allowed. Cc-only delivery is allowed.
 */
export function isEligibleForInboundRuleEvaluation(
  email: InboundEmailEligibility,
  ctx: InboundMailboxContext,
): boolean {
  if (
    ctx.projectCreatedAt &&
    !isEmailEligibleForInboundSync(email.date, ctx.projectCreatedAt)
  ) {
    return false;
  }
  if (
    isEmailFromSupportMailbox(ctx.supportEmail, email.fromEmail) &&
    !isRelayedInboundMail(ctx.supportEmail, email)
  ) {
    return false;
  }
  return true;
}

export function isEligibleForInboundRulePreview(
  email: InboundEmailEligibility,
  ctx: InboundMailboxContext,
  threadIndex: ThreadMatchIndex,
): boolean {
  if (!isEligibleForInboundRuleEvaluation(email, ctx)) {
    return false;
  }
  return !emailMatchesExistingThread(email, threadIndex, email.date);
}
