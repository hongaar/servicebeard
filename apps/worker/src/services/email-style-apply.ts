import type { projects } from "@servicebeard/db";
import type { QuotedEmail } from "@servicebeard/shared";
import {
  normalizeEmailStyleConfig,
  renderPlainEmailPreviewHtml,
  renderStyledEmailHtml,
  splitReplyAndQuote,
  type EmailStyleLogo,
  type EmailStylePreset,
} from "@servicebeard/shared";
import { markdownToHtml } from "@servicebeard/shared/email-content";

export const EMAIL_STYLE_LOGO_CID = "servicebeard-logo@local";

export interface EmailStyleAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  cid: string;
}

export function buildLogoAttachment(
  logo: EmailStyleLogo,
): EmailStyleAttachment {
  const extension =
    logo.contentType.split("/")[1]?.replace("+xml", "") ?? "img";
  return {
    filename: `logo.${extension}`,
    content: Buffer.from(logo.data, "base64"),
    contentType: logo.contentType,
    cid: EMAIL_STYLE_LOGO_CID,
  };
}

export function applyEmailStyleToHtml(
  project: typeof projects.$inferSelect,
  options: {
    contentMarkdown: string;
    contentHtml?: string;
    quoted: QuotedEmail | null;
    fallbackHtml: string;
  },
): { html: string; attachments: EmailStyleAttachment[] } {
  const preset = (project.emailStylePreset ?? "none") as EmailStylePreset;
  const { replyText } = options.quoted
    ? splitReplyAndQuote(options.contentMarkdown, options.quoted)
    : { replyText: options.contentMarkdown.trim(), quotedText: null };

  const contentHtml = options.contentHtml ?? markdownToHtml(replyText);

  if (preset === "none") {
    return {
      html: renderPlainEmailPreviewHtml(contentHtml, options.quoted),
      attachments: [],
    };
  }

  const config = normalizeEmailStyleConfig(project.emailStyleConfig, {
    projectName: project.name,
  });

  const attachments: EmailStyleAttachment[] = [];
  let logoSrc: string | null = null;

  if (config.logo && preset === "branded") {
    attachments.push(buildLogoAttachment(config.logo));
    logoSrc = `cid:${EMAIL_STYLE_LOGO_CID}`;
  }

  const styled = renderStyledEmailHtml({
    preset,
    config,
    contentHtml,
    quoted: options.quoted,
    logoSrc,
  });

  return {
    html: styled ?? options.fallbackHtml,
    attachments,
  };
}
