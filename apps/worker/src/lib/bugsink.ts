import * as Sentry from "@sentry/bun";
import {
  bugsinkUserPayload,
  normalizeBugsinkCaptureContext,
  type BugsinkCaptureContext,
} from "@servicebeard/shared";

const SERVICE = "worker";
const dsn = process.env.BUGSINK_WORKER_DSN;

export function initBugsink() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    serverName: SERVICE,
    tracesSampleRate: 0,
    sendDefaultPii: true,
    initialScope: {
      tags: { service: SERVICE },
    },
  });
}

export function captureBugsinkError(
  error: unknown,
  context?: BugsinkCaptureContext | Record<string, unknown>,
) {
  if (!dsn) return;

  const { user, extra } = normalizeBugsinkCaptureContext(context);

  Sentry.withScope((scope) => {
    scope.setTag("service", SERVICE);
    if (user) {
      scope.setUser(bugsinkUserPayload(user));
    }
    if (extra) {
      scope.setExtras(extra);
    }
    Sentry.captureException(error);
  });
}
