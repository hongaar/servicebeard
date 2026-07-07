export const PROJECT_STATUS_SEVERITIES = [
  "error",
  "warning",
  "info",
  "success",
] as const;
export type ProjectStatusSeverity = (typeof PROJECT_STATUS_SEVERITIES)[number];

export const PROJECT_STATUS_CATEGORIES = ["mail", "provider"] as const;
export type ProjectStatusCategory = (typeof PROJECT_STATUS_CATEGORIES)[number];

const MAIL_OPERATIONS = new Set([
  "test-mail",
  "imap-poll",
  "imap-poll-project",
  "fetch-since",
  "poll",
  "send-mail",
  "send-ack",
  "send-outbound-email",
  "mark-seen",
]);

const PROVIDER_OPERATIONS = new Set([
  "test-provider",
  "ensure-webhook",
  "process-message",
  "list-comments",
  "comment-poll",
  "send-email",
  "comment-poll-project",
  "upload-inline-image",
  "download-image",
  "create-issue",
  "add-issue-comment",
]);

/** Operations whose failures are retried automatically and recorded as warnings. */
const RETRIABLE_FAILURE_OPERATIONS = new Set([
  "process-message",
  "list-comments",
  "fetch-since",
  "poll",
  "imap-poll",
  "imap-poll-project",
  "comment-poll",
  "comment-poll-project",
  "mark-seen",
  "send-email",
  "send-mail",
]);

export function classifySyncFailureSeverity(
  operation: string,
): Extract<ProjectStatusSeverity, "error" | "warning"> {
  return RETRIABLE_FAILURE_OPERATIONS.has(operation) ? "warning" : "error";
}

export function classifySyncError(
  service: string,
  operation: string,
): ProjectStatusCategory | null {
  if (
    service === "imap" ||
    service === "smtp" ||
    MAIL_OPERATIONS.has(operation)
  ) {
    return "mail";
  }

  if (
    service === "gitlab" ||
    service === "github" ||
    service === "linear" ||
    service === "inbound" ||
    service === "outbound-email" ||
    PROVIDER_OPERATIONS.has(operation)
  ) {
    return "provider";
  }

  return null;
}

export function isQuietProvider404(operation: string): boolean {
  return (
    operation === "list-comments" ||
    operation === "comment-poll" ||
    operation === "comment-poll-project"
  );
}

export const TEAM_ROLES = ["owner", "admin", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const PROVIDERS = ["gitlab", "github", "linear"] as const;
export type ProviderType = (typeof PROVIDERS)[number];

export const RULE_MATCH_FIELDS = ["sender", "subject", "body"] as const;
export type RuleMatchField = (typeof RULE_MATCH_FIELDS)[number];

export const EMAIL_DIRECTIONS = ["inbound", "outbound"] as const;
export type EmailDirection = (typeof EMAIL_DIRECTIONS)[number];

export const JOB_TYPES = [
  "imap-poll",
  "process-message",
  "comment-poll",
  "send-email",
  "ensure-webhook",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const SYNC_MARKER_PREFIX = "<!-- servicebeard-sync:";
export const SYNC_MARKER_SUFFIX = "-->";
const LINEAR_SYNC_MARKER_PREFIX = "servicebeard-sync:";

export function buildSyncMarker(threadId: string, provider?: string): string {
  if (provider === "linear") {
    return `\n\n[//]: # (${LINEAR_SYNC_MARKER_PREFIX}${threadId})`;
  }
  return `${SYNC_MARKER_PREFIX}${threadId}${SYNC_MARKER_SUFFIX}`;
}

export function isServicebeardSyncedContent(body: string): boolean {
  if (body.includes(SYNC_MARKER_PREFIX)) return true;
  return /\[\/\/\]:\s*#\s*\(\s*servicebeard-sync:/i.test(body);
}

export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .trim()
    .toLowerCase();
}

/** True when the subject line indicates a reply (Re:/Fwd:/Fw:). */
export function isReplySubject(subject: string): boolean {
  return /^(re|fwd|fw):\s*/i.test(subject.trim());
}
