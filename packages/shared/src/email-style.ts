import { styleEmailContentHtml } from "./email-content";
import {
  formatQuoteAttributionLine,
  formatQuotedReply,
  type QuotedEmail,
} from "./mail";

export type EmailStylePreset = "none" | "minimal" | "branded";

export interface EmailStyleLogo {
  data: string;
  contentType: string;
}

export interface EmailStyleConfig {
  primaryColor: string;
  logo: EmailStyleLogo | null;
  showTeamName: boolean;
  teamName: string;
  showProjectName: boolean;
  projectName: string;
}

export const MAX_LOGO_BYTES = 100 * 1024;

export const DEFAULT_EMAIL_STYLE_CONFIG: EmailStyleConfig = {
  primaryColor: "#2563eb",
  logo: null,
  showTeamName: true,
  teamName: "",
  showProjectName: true,
  projectName: "",
};

export const EMAIL_STYLE_PRESETS: Array<{
  id: EmailStylePreset;
  label: string;
  description: string;
}> = [
  {
    id: "none",
    label: "Plain text",
    description: "Plain text email",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Simple header with accent color",
  },
  {
    id: "branded",
    label: "Branded",
    description: "Logo, colored header bar, and card layout",
  },
];

export interface RenderStyledEmailHtmlInput {
  preset: EmailStylePreset;
  config: EmailStyleConfig;
  contentHtml: string;
  quoted?: QuotedEmail | null;
  logoSrc?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

function resolvePrimaryColor(color: string): string {
  return isValidHexColor(color)
    ? color
    : DEFAULT_EMAIL_STYLE_CONFIG.primaryColor;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

/** Picks light or dark header text for readable contrast on a solid background. */
export function contrastColorOnBackground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

function buildHeaderLabels(config: EmailStyleConfig): string[] {
  const labels: string[] = [];
  if (config.showTeamName && config.teamName.trim()) {
    labels.push(config.teamName.trim());
  }
  if (config.showProjectName && config.projectName.trim()) {
    labels.push(config.projectName.trim());
  }
  return labels;
}

function prepareContentHtml(contentHtml: string): string {
  return styleEmailContentHtml(contentHtml);
}

function renderQuotedSection(quoted: QuotedEmail | null | undefined): string {
  const body = quoted?.body.trim();
  if (!quoted || !body) return "";

  const attribution = escapeHtml(formatQuoteAttributionLine(quoted));
  const bodyHtml = escapeHtml(body).replace(/\n/g, "<br>");

  return `<table role="presentation" class="sb-email-quote" data-sb-quote="1" width="100%" cellpadding="0" cellspacing="0" dir="ltr" style="margin: 24px 0 0; border: 0; border-collapse: collapse;">
  <tr>
    <td colspan="2" style="padding: 0 0 8px 0; color: #6b7280; font-size: 14px; line-height: 1.5;">${attribution}</td>
  </tr>
  <tr>
    <td width="3" style="width: 3px; background: #d1d5db; font-size: 0; line-height: 0;">&nbsp;</td>
    <td style="padding: 0 0 0 12px; color: #6b7280; font-size: 14px; line-height: 1.5; border: 0; margin: 0;">${bodyHtml}</td>
  </tr>
</table>`;
}

function renderMinimalLayout(
  config: EmailStyleConfig,
  contentHtml: string,
  quotedSection: string,
): string {
  const primaryColor = resolvePrimaryColor(config.primaryColor);
  const labels = buildHeaderLabels(config);
  const headerText = labels.length > 0 ? labels.join(" · ") : "";

  const header = headerText
    ? `<p style="margin: 0 0 1rem; font-size: 0.875rem; font-weight: 600; color: ${primaryColor};">${escapeHtml(headerText)}</p>`
    : `<div style="margin: 0 0 1rem; height: 3px; background: ${primaryColor}; border-radius: 2px;"></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111827; background: #f9fafb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 32px 16px; background: #f9fafb;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 8px; border-collapse: separate;">
          <tr>
            <td style="padding: 24px;">
              ${header}
              <div style="font-size: 1rem;">${contentHtml}</div>
              ${quotedSection}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderBrandedLayout(
  config: EmailStyleConfig,
  contentHtml: string,
  quotedSection: string,
  logoSrc: string | null | undefined,
): string {
  const primaryColor = resolvePrimaryColor(config.primaryColor);
  const headerTextColor = contrastColorOnBackground(primaryColor);
  const labels = buildHeaderLabels(config);
  const headerText = labels.join(" · ");

  const logoHtml = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" alt="" style="max-height: 48px; max-width: 200px; width: auto; height: auto; display: block;" />`
    : "";

  const headerContent =
    logoHtml || headerText
      ? `<table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          ${logoHtml ? `<td style="vertical-align: middle; width: 1px; white-space: nowrap; padding: 0 12px 0 0;">${logoHtml}</td>` : ""}
          ${headerText ? `<td style="vertical-align: middle; color: ${headerTextColor}; font-size: 0.875rem; font-weight: 600;">${escapeHtml(headerText)}</td>` : ""}
        </tr>
      </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111827; background: #f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 32px 16px; background: #f3f4f6;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 8px; overflow: hidden; border-collapse: separate; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          ${headerContent ? `<tr><td style="background: ${primaryColor}; padding: 20px 24px;">${headerContent}</td></tr>` : ""}
          <tr>
            <td style="padding: 24px;">
              <div style="font-size: 1rem;">${contentHtml}</div>
              ${quotedSection}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderStyledEmailHtml(
  input: RenderStyledEmailHtmlInput,
): string | null {
  const { preset, config, contentHtml, quoted, logoSrc } = input;

  if (preset === "none") return null;

  const styledContentHtml = prepareContentHtml(contentHtml);
  const quotedSection = renderQuotedSection(quoted);

  if (preset === "minimal") {
    return renderMinimalLayout(config, styledContentHtml, quotedSection);
  }

  return renderBrandedLayout(config, styledContentHtml, quotedSection, logoSrc);
}

/** Preview HTML for the plain-text (none) preset — markdown body with quoted history. */
export function renderPlainEmailPreviewHtml(
  contentHtml: string,
  quoted?: QuotedEmail | null,
): string {
  const styledContentHtml = prepareContentHtml(contentHtml);
  const quotedSection = renderQuotedSection(quoted);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111827; background: #ffffff;">
  <div style="font-size: 1rem;">${styledContentHtml}</div>
  ${quotedSection}
</body>
</html>`;
}

export function logoDataUri(logo: EmailStyleLogo): string {
  return `data:${logo.contentType};base64,${logo.data}`;
}

export function formatQuotedReplyText(
  replyText: string,
  quoted: QuotedEmail,
): string {
  if (!quoted.body.trim()) return replyText.trim();
  return formatQuotedReply(replyText, quoted);
}

export function splitReplyAndQuote(
  replyText: string,
  quoted: QuotedEmail,
): { replyText: string; quotedText: string | null } {
  if (!quoted.body.trim()) {
    return { replyText: replyText.trim(), quotedText: null };
  }

  const full = formatQuotedReply(replyText, quoted);
  const marker = "\n\nOn ";
  const markerIndex = full.indexOf(marker);
  if (markerIndex === -1) {
    return { replyText: replyText.trim(), quotedText: null };
  }

  return {
    replyText: full.slice(0, markerIndex).trim(),
    quotedText: full.slice(markerIndex + 2).trim(),
  };
}

export function normalizeEmailStyleConfig(
  config: Partial<EmailStyleConfig> | null | undefined,
  defaults?: { teamName?: string; projectName?: string },
): EmailStyleConfig {
  return {
    primaryColor:
      config?.primaryColor ?? DEFAULT_EMAIL_STYLE_CONFIG.primaryColor,
    logo: config?.logo ?? null,
    showTeamName:
      config?.showTeamName ?? DEFAULT_EMAIL_STYLE_CONFIG.showTeamName,
    teamName: config?.teamName?.trim() || defaults?.teamName?.trim() || "",
    showProjectName:
      config?.showProjectName ?? DEFAULT_EMAIL_STYLE_CONFIG.showProjectName,
    projectName:
      config?.projectName?.trim() || defaults?.projectName?.trim() || "",
  };
}
