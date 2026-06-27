import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_BUGSINK_DSN;

export function initBugsink() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
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

export function isBugsinkEnabled() {
  return Boolean(dsn);
}
