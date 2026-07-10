function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  min = 1,
  max = 100,
): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function getSendEmailConcurrency(): number {
  return parsePositiveInt(process.env.SEND_EMAIL_CONCURRENCY, 5, 1, 50);
}

export function getImapPollConcurrency(): number {
  return parsePositiveInt(process.env.IMAP_POLL_CONCURRENCY, 3, 1, 50);
}

export function getCommentPollConcurrency(): number {
  return parsePositiveInt(process.env.COMMENT_POLL_CONCURRENCY, 3, 1, 50);
}

export function getSmtpMaxConnections(): number {
  return parsePositiveInt(process.env.SMTP_MAX_CONNECTIONS, 3, 1, 20);
}

export function getSmtpMaxMessages(): number {
  return parsePositiveInt(process.env.SMTP_MAX_MESSAGES, 100, 1, 1000);
}

export function getSmtpIdleTtlMs(): number {
  return parsePositiveInt(
    process.env.SMTP_IDLE_TTL_MS,
    60_000,
    5_000,
    3_600_000,
  );
}

export function getSmtpMaxPools(): number {
  return parsePositiveInt(process.env.SMTP_MAX_POOLS, 50, 1, 500);
}

/** Kept well under reverse-proxy timeouts so unreachable hosts fail fast. */
export const SMTP_CONNECTION_TIMEOUT_MS = 8_000;
export const SMTP_GREETING_TIMEOUT_MS = 8_000;
export const SMTP_SOCKET_TIMEOUT_MS = 12_000;
