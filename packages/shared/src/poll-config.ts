export const DEFAULT_IMAP_POLL_INTERVAL_SECONDS = 60;
export const DEFAULT_COMMENT_POLL_INTERVAL_SECONDS = 120;
export const DEFAULT_IMAP_POLL_OVERLAP_HOURS = 24;
export const MIN_POLL_INTERVAL_SECONDS = 60;
export const MIN_IMAP_POLL_OVERLAP_HOURS = 1;
export const MAX_IMAP_POLL_OVERLAP_HOURS = 168;

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

function parseOverlapHours(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (
    !Number.isFinite(parsed) ||
    parsed < MIN_IMAP_POLL_OVERLAP_HOURS ||
    parsed > MAX_IMAP_POLL_OVERLAP_HOURS
  ) {
    return fallback;
  }
  return parsed;
}

/** How far before the ingest watermark to re-scan IMAP for out-of-order delivery. */
export function getImapPollOverlapMs(): number {
  const hours = parseOverlapHours(
    process.env.IMAP_POLL_OVERLAP_HOURS,
    DEFAULT_IMAP_POLL_OVERLAP_HOURS,
  );
  return hours * 60 * 60 * 1000;
}
