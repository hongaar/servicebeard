export const APP_NAME = "ServiceBeard";

/** Build a browser tab title: `Part · Part · ServiceBeard` */
export function documentTitle(...parts: (string | undefined)[]): string {
  const filtered = parts
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => part.trim());
  if (filtered.length === 0) return APP_NAME;
  return `${filtered.join(" · ")} · ${APP_NAME}`;
}

export function routeHead(...parts: string[]) {
  return () => ({
    meta: [{ title: documentTitle(...parts) }],
  });
}
