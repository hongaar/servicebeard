/** True when the app is running on a local development host. */
export function isLocalDev(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || import.meta.env.DEV;
}
