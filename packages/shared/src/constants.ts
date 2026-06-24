export const TEAM_ROLES = ["owner", "admin", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const PROVIDERS = ["gitlab"] as const;
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

export function buildSyncMarker(threadId: string): string {
  return `${SYNC_MARKER_PREFIX}${threadId}${SYNC_MARKER_SUFFIX}`;
}

export function isServicebeardSyncedContent(body: string): boolean {
  return body.includes(SYNC_MARKER_PREFIX);
}

export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .trim()
    .toLowerCase();
}
