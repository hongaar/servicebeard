import * as Sentry from "@sentry/bun";

const dsn = process.env.BUGSINK_DSN;

export function initBugsink() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0,
    sendDefaultPii: true,
  });
}

export function captureBugsinkError(
  error: unknown,
  context?: Record<string, unknown>,
) {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
