import { marked } from "marked";
import TurndownService from "turndown";
import type { EmailInlineImage } from "./types";

export type { EmailInlineImage };

export interface RawEmailAttachment {
  filename?: string | null;
  contentType: string;
  content: Buffer;
  cid?: string | null;
}

export interface MarkdownImageRef {
  alt: string;
  url: string;
  fullMatch: string;
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});

turndown.addRule("strikethrough", {
  filter: ["del", "s"],
  replacement: (content) => `~~${content}~~`,
});

const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(([^)]+)\)/g;

export function normalizeContentId(contentId: string): string {
  return contentId.replace(/^<|>$/g, "").toLowerCase();
}

export function isImageContentType(contentType: string): boolean {
  return contentType.toLowerCase().startsWith("image/");
}

export function htmlToMarkdown(html: string): string {
  const cleaned = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  return turndown.turndown(cleaned).trim();
}

export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

export function markdownToPlainText(markdown: string): string {
  const html = markdownToHtml(markdown);
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractMarkdownImages(markdown: string): MarkdownImageRef[] {
  const images: MarkdownImageRef[] = [];
  const pattern = new RegExp(MARKDOWN_IMAGE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    images.push({
      alt: match[1] ?? "",
      url: match[2] ?? "",
      fullMatch: match[0],
    });
  }

  return images;
}

export function replaceCidImagesInMarkdown(
  markdown: string,
  cidToMarkdown: Map<string, string>,
): string {
  return markdown.replace(
    /!\[([^\]]*)\]\(cid:([^)]+)\)/gi,
    (_match, alt: string, cid: string) => {
      const uploaded = cidToMarkdown.get(normalizeContentId(cid));
      if (uploaded) return uploaded;
      return `![${alt}](cid:${cid})`;
    },
  );
}

export function buildEmailMarkdownBody(
  text: string,
  html: string | null,
): string {
  if (html) return htmlToMarkdown(html);
  return text;
}

export function buildEmailPlainBody(
  text: string,
  html: string | null,
  markdown: string,
): string {
  if (text) return text;
  if (markdown) return markdownToPlainText(markdown);
  if (html) return htmlToMarkdown(html);
  return "";
}

export function replaceMarkdownImagesWithCid(
  markdown: string,
  urlToCid: Map<string, string>,
): string {
  return markdown.replace(MARKDOWN_IMAGE, (full, alt: string, url: string) => {
    const cid = urlToCid.get(url);
    if (!cid) return full;
    return `![${alt}](cid:${cid})`;
  });
}

export function replaceHtmlImageUrlsWithCid(
  html: string,
  urlToCid: Map<string, string>,
): string {
  return html.replace(
    /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (full, before: string, src: string, after: string) => {
      const cid = urlToCid.get(src);
      if (!cid) return full;
      return `<img${before}src="cid:${cid}"${after}>`;
    },
  );
}

export function extractInlineImages(
  attachments: RawEmailAttachment[],
): EmailInlineImage[] {
  return attachments
    .filter((a) => isImageContentType(a.contentType))
    .map((attachment) => ({
      filename:
        attachment.filename ?? `image-${attachment.cid ?? "attachment"}`,
      contentType: attachment.contentType,
      content: attachment.content,
      contentId: attachment.cid ?? null,
    }));
}

export function buildParsedEmailContent(
  text: string | false | undefined,
  html: string | false | undefined,
  attachments: RawEmailAttachment[],
): {
  body: string;
  bodyMarkdown: string;
  bodyHtml: string | null;
  inlineImages: EmailInlineImage[];
} {
  const plainText = typeof text === "string" ? text.trim() : "";
  const bodyHtml = typeof html === "string" ? html : null;
  const inlineImages = extractInlineImages(attachments);
  const bodyMarkdown = buildEmailMarkdownBody(plainText, bodyHtml);
  const body = buildEmailPlainBody(plainText, bodyHtml, bodyMarkdown).trim();

  return {
    body,
    bodyMarkdown,
    bodyHtml,
    inlineImages,
  };
}
