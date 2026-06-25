import type { CSSProperties } from "react";

function expandHex(hex: string): string | null {
  const raw = hex.replace(/^#/, "");
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized : null;
}

/** Text color for a GitHub/GitLab-style label tag background. */
export function providerLabelTextColor(color: string): string {
  const normalized = expandHex(color);
  if (!normalized) return "#ffffff";

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#24292f" : "#ffffff";
}

export function providerLabelTagVars(color: string | null): CSSProperties {
  if (!color) return {};
  return {
    "--label-bg": color,
    "--label-fg": providerLabelTextColor(color),
  } as CSSProperties;
}
