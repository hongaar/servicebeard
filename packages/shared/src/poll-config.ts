export const DEFAULT_IMAP_POLL_INTERVAL_SECONDS = 60;
export const DEFAULT_COMMENT_POLL_INTERVAL_SECONDS = 120;
export const MIN_POLL_INTERVAL_SECONDS = 60;

function parsePollIntervalSeconds(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_POLL_INTERVAL_SECONDS) {
    return fallback;
  }
  return parsed;
}

export function getImapPollIntervalSeconds(): number {
  return parsePollIntervalSeconds(
    process.env.IMAP_POLL_INTERVAL_SECONDS,
    DEFAULT_IMAP_POLL_INTERVAL_SECONDS,
  );
}

export function getCommentPollIntervalSeconds(): number {
  return parsePollIntervalSeconds(
    process.env.COMMENT_POLL_INTERVAL_SECONDS,
    DEFAULT_COMMENT_POLL_INTERVAL_SECONDS,
  );
}
