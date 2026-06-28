import type { SessionUser } from "./types";

export type BugsinkCaptureContext = {
  user?: SessionUser | null;
  extra?: Record<string, unknown>;
};

export function normalizeBugsinkCaptureContext(
  context?: BugsinkCaptureContext | Record<string, unknown>,
): BugsinkCaptureContext {
  if (!context) return {};
  if ("user" in context || "extra" in context) {
    return context as BugsinkCaptureContext;
  }
  return { extra: context };
}

export function bugsinkUserPayload(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    username: user.name ?? undefined,
  };
}
