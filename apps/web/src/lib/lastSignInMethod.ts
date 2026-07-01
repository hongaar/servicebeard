import type { LoginProviderType } from "@servicebeard/shared/login";

export type SignInMethod = LoginProviderType | "passkey" | "email";

const STORAGE_KEY = "servicebeard:last-sign-in-method";

const SIGN_IN_METHODS = new Set<string>([
  "oidc",
  "github",
  "gitlab",
  "linear",
  "local",
  "passkey",
  "email",
]);

export function getLastUsedSignInMethod(): SignInMethod | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value || !SIGN_IN_METHODS.has(value)) return null;
    return value as SignInMethod;
  } catch {
    return null;
  }
}

export function setLastUsedSignInMethod(method: SignInMethod): void {
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // Ignore quota / private browsing errors.
  }
}

export function moveLastUsedSignInMethodToFront<
  T extends { method: SignInMethod },
>(items: T[], lastUsed: SignInMethod | null): T[] {
  if (!lastUsed || items.length < 2) return items;

  const index = items.findIndex((item) => item.method === lastUsed);
  if (index <= 0) return items;

  return [items[index]!, ...items.slice(0, index), ...items.slice(index + 1)];
}
