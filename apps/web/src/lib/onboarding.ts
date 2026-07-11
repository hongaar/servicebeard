type OnboardingPhase = "welcome" | "project-hint" | "done";

const STORAGE_PREFIX = "servicebeard:onboarding:";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function getOnboardingPhase(userId: string): OnboardingPhase | null {
  try {
    const value = localStorage.getItem(storageKey(userId));
    if (value === "welcome" || value === "project-hint" || value === "done") {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

function setOnboardingPhase(userId: string, phase: OnboardingPhase) {
  try {
    localStorage.setItem(storageKey(userId), phase);
  } catch {
    // Ignore quota / private browsing errors.
  }
}

export function shouldShowWelcome(
  userId: string,
  teamCount: number,
  pendingInviteCount: number,
): boolean {
  if (teamCount > 0 || pendingInviteCount > 0) return false;
  const phase = getOnboardingPhase(userId);
  return phase !== "done" && phase !== "project-hint";
}

export function markWelcomeComplete(userId: string) {
  setOnboardingPhase(userId, "project-hint");
}

export function isProjectHintPending(userId: string): boolean {
  return getOnboardingPhase(userId) === "project-hint";
}

export function markOnboardingDone(userId: string) {
  setOnboardingPhase(userId, "done");
}
