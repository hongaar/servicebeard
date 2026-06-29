/** Normalize a post-login redirect path (handles accidental double-encoding). */
export function normalizeRedirectPath(redirect?: string): string | null {
  if (!redirect?.trim()) return null;

  let value = redirect.trim();
  for (let i = 0; i < 3; i++) {
    if (value.startsWith("/")) return value;
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }

  return value.startsWith("/") ? value : null;
}
