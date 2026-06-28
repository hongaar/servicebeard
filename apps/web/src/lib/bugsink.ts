import * as Sentry from "@sentry/react";
import {
    bugsinkUserPayload,
    normalizeBugsinkCaptureContext,
    type BugsinkCaptureContext,
    type SessionUser,
} from "@servicebeard/shared";

const SERVICE = "web";
const dsn = import.meta.env.VITE_BUGSINK_DSN;

export function initBugsink() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    sendDefaultPii: true,
    initialScope: {
      tags: { service: SERVICE },
    },
  });
}

export function setBugsinkUser(user: SessionUser | null) {
  if (!dsn) return;
  Sentry.setUser(user ? bugsinkUserPayload(user) : null);
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

export function isBugsinkEnabled() {
  return Boolean(dsn);
}
