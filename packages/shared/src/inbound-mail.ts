import { normalizeSubject } from "./constants";
import { parseMailFromAddress } from "./mail";

export interface InboundMailboxContext {
  supportEmail: string;
  projectCreatedAt?: Date;
}

export interface InboundEmailEligibility {
  fromEmail: string;
  subject: string;
  inReplyTo: string | null;
  references: string[];
  date: Date;
}

export interface ThreadMatchIndex {
  storedMessageIds: ReadonlySet<string>;
  storedInReplyTos: ReadonlySet<string>;
  subjectSenderKeys: ReadonlySet<string>;
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
  return normalizeMailboxEmail(fromEmail) === normalizeMailboxEmail(supportEmail);
}

export function buildThreadMatchIndex(
  storedMessages: Array<{ messageId: string; inReplyTo: string | null }>,
  threads: Array<{ subjectNormalized: string; originalSenderEmail: string }>,
): ThreadMatchIndex {
  return {
    storedMessageIds: new Set(storedMessages.map((message) => message.messageId)),
    storedInReplyTos: new Set(
      storedMessages
        .map((message) => message.inReplyTo)
        .filter((value): value is string => Boolean(value)),
    ),
    subjectSenderKeys: new Set(
      threads.map(
        (thread) =>
          `${thread.subjectNormalized}\0${thread.originalSenderEmail.toLowerCase()}`,
      ),
    ),
  };
}

/** Mirrors worker thread detection for rule preview and testing. */
export function emailMatchesExistingThread(
  email: Pick<InboundEmailEligibility, "inReplyTo" | "references" | "subject" | "fromEmail">,
  index: ThreadMatchIndex,
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

  const subjectSenderKey = `${normalizeSubject(email.subject)}\0${email.fromEmail.toLowerCase()}`;
  return index.subjectSenderKeys.has(subjectSenderKey);
}

/**
 * Mail that can create a new issue via routing rules — excludes copies sent by the
 * support mailbox and pre-project messages. Cc-only delivery is allowed.
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
  if (isEmailFromSupportMailbox(ctx.supportEmail, email.fromEmail)) {
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
  return !emailMatchesExistingThread(email, threadIndex);
}
