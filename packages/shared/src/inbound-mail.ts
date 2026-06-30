import { normalizeSubject } from "./constants";
import { parseMailFromAddress } from "./mail";

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
  threads: Array<{ subjectNormalized: string; originalSenderEmail: string }>,
): ThreadMatchIndex {
  return {
    storedMessageIds: new Set(
      storedMessages.map((message) => message.messageId),
    ),
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
  email: Pick<
    InboundEmailEligibility,
    "inReplyTo" | "references" | "subject" | "fromEmail" | "senderEmail"
  >,
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

  const subjectSenderKey = `${normalizeSubject(email.subject)}\0${effectiveSenderEmail(email).toLowerCase()}`;
  return index.subjectSenderKeys.has(subjectSenderKey);
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
  return !emailMatchesExistingThread(email, threadIndex);
}
