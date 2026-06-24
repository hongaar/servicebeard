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

export interface GitLabUploadRef {
  secret: string;
  filename: string;
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
const GITLAB_MARKDOWN_IMAGE =
  /!\[([^\]]*)\]\(([^)]+)\)(?:\{width=(?:"\d+(?:%|px)?"|\d+(?:%|px)?)\s+height=(?:"\d+(?:%|px)?"|\d+(?:%|px)?)\})?/gi;
const GITLAB_IMAGE_DIMENSIONS =
  /\{width=(?:"\d+(?:%|px)?"|\d+(?:%|px)?)\s+height=(?:"\d+(?:%|px)?"|\d+(?:%|px)?)\}/gi;
const HTML_UPLOAD_IMAGE =
  /<img\b[^>]*\bsrc=["']([^"']*\/uploads\/[^"']+)["'][^>]*>/gi;
const DATA_URI_IMAGE_MD =
  /!\[([^\]]*)\]\((data:image\/([^;]+);base64,([^)]+))\)/gi;
const IMG_TAG = /<img\b([^>]*?)>/gi;
const IMAGE_PLACEHOLDER_PREFIX = "SBPLACEHOLDERIMAGE";

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

export function resolveProviderImageUrl(
  url: string,
  baseUrl: string,
): string | null {
  return normalizeUploadImagePath(url, baseUrl);
}

export function replaceGitLabImagesWithCid(
  markdown: string,
  urlToCid: Map<string, string>,
  baseUrl?: string,
): string {
  return markdown.replace(GITLAB_MARKDOWN_IMAGE, (full, alt: string, url: string) => {
    const cid =
      urlToCid.get(url) ??
      (baseUrl ? urlToCid.get(normalizeUploadImagePath(url, baseUrl) ?? "") : undefined);
    if (!cid) return full;
    return `![${alt}](cid:${cid})`;
  });
}

export function replaceMarkdownImagesWithCid(
  markdown: string,
  urlToCid: Map<string, string>,
  baseUrl?: string,
): string {
  const withGitLab = replaceGitLabImagesWithCid(markdown, urlToCid, baseUrl);
  return withGitLab.replace(MARKDOWN_IMAGE, (full, alt: string, url: string) => {
    const cid =
      urlToCid.get(url) ??
      (baseUrl ? urlToCid.get(normalizeUploadImagePath(url, baseUrl) ?? "") : undefined);
    if (!cid) return full;
    return `![${alt}](cid:${cid})`;
  });
}

export function replaceHtmlImageUrlsWithCid(
  html: string,
  urlToCid: Map<string, string>,
  baseUrl?: string,
): string {
  const withoutDimensions = html.replace(GITLAB_IMAGE_DIMENSIONS, "");
  return withoutDimensions.replace(
    /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (full, before: string, src: string, after: string) => {
      const cid =
        urlToCid.get(src) ??
        (baseUrl ? urlToCid.get(normalizeUploadImagePath(src, baseUrl) ?? "") : undefined);
      if (!cid) return full;
      return `<img${before}src="cid:${cid}"${after}>`;
    },
  );
}

export function isResolvableImageUrl(url: string, baseUrl?: string): boolean {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith("/uploads/")) return Boolean(baseUrl);
  if (baseUrl && trimmed.includes("/uploads/")) return true;
  return false;
}

export function parseGitLabUploadPath(url: string): GitLabUploadRef | null {
  const trimmed = url.trim();
  let pathname = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      pathname = new URL(trimmed).pathname;
    }
  } catch {
    return null;
  }

  const match = pathname.match(/\/uploads\/([^/]+)\/(.+)$/);
  if (!match?.[1] || !match[2]) return null;

  return {
    secret: match[1],
    filename: decodeURIComponent(match[2]),
  };
}

export function normalizeUploadImagePath(url: string, baseUrl: string): string | null {
  const trimmed = url.trim();
  if (trimmed.startsWith("/uploads/")) {
    return `${baseUrl.replace(/\/$/, "")}${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const base = new URL(baseUrl);
      if (parsed.origin !== base.origin) return trimmed;
      if (parsed.pathname.startsWith("/uploads/")) return trimmed;
      const uploadPath = parsed.pathname.match(/(\/uploads\/[^/]+\/[^/]+)$/)?.[1];
      if (uploadPath) return `${base.origin}${uploadPath}`;
      return trimmed;
    } catch {
      return trimmed;
    }
  }

  const relative = trimmed.match(/(\/uploads\/[^/]+\/[^/]+)/)?.[1];
  if (relative) return `${baseUrl.replace(/\/$/, "")}${relative}`;
  return null;
}

export function stripGitLabImageDimensions(markdown: string): string {
  return markdown.replace(GITLAB_IMAGE_DIMENSIONS, "");
}

export function prepareGitLabNoteForOutboundEmail(markdown: string): string {
  return stripGitLabImageDimensions(markdown);
}

function dedupeImageRefs(images: MarkdownImageRef[]): MarkdownImageRef[] {
  const seen = new Set<string>();
  const result: MarkdownImageRef[] = [];
  for (const image of images) {
    const key = image.url.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(image);
  }
  return result;
}

export function extractGitLabMarkdownImages(markdown: string): MarkdownImageRef[] {
  const images: MarkdownImageRef[] = [];
  const pattern = new RegExp(GITLAB_MARKDOWN_IMAGE.source, "gi");
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

export function extractHtmlUploadImages(content: string): MarkdownImageRef[] {
  const images: MarkdownImageRef[] = [];
  const pattern = new RegExp(HTML_UPLOAD_IMAGE.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const url = match[1] ?? "";
    images.push({
      alt: "",
      url,
      fullMatch: match[0],
    });
  }

  return images;
}

export function collectOutboundImageRefs(
  content: string,
  baseUrl: string,
): MarkdownImageRef[] {
  const prepared = prepareGitLabNoteForOutboundEmail(content);
  return dedupeImageRefs([
    ...extractGitLabMarkdownImages(prepared),
    ...extractMarkdownImages(prepared),
    ...extractHtmlUploadImages(content),
  ]).filter((image) => isResolvableImageUrl(image.url, baseUrl));
}

function imageExtension(subtype: string): string {
  const normalized = subtype.toLowerCase();
  if (normalized === "jpeg") return "jpg";
  if (normalized === "svg+xml") return "svg";
  return normalized;
}

function htmlAttribute(attrs: string, name: string): string | null {
  const quoted = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  if (quoted?.[1]) return quoted[1];
  const bare = attrs.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i"));
  return bare?.[1] ?? null;
}

export function imagePlaceholder(index: number): string {
  return `${IMAGE_PLACEHOLDER_PREFIX}${index}`;
}

export interface HtmlImageSlot {
  placeholder: string;
  filename: string;
  contentType: string;
  content: Buffer;
  contentId: string | null;
}

export function replaceHtmlImagesWithPlaceholders(html: string): {
  html: string;
  slots: HtmlImageSlot[];
} {
  const slots: HtmlImageSlot[] = [];
  let index = 0;

  const replaced = html.replace(IMG_TAG, (full, attrs: string) => {
    const src = htmlAttribute(attrs, "src");
    if (!src) return full;

    const placeholder = imagePlaceholder(index);
    index += 1;

    if (src.startsWith("data:image/")) {
      const match = src.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (!match) return full;
      const subtype = match[1] ?? "png";
      slots.push({
        placeholder,
        filename: `inline-image-${index}.${imageExtension(subtype)}`,
        contentType: `image/${subtype}`,
        content: Buffer.from(match[2] ?? "", "base64"),
        contentId: null,
      });
      return `<p>${placeholder}</p>`;
    }

    if (src.startsWith("cid:")) {
      const cid = normalizeContentId(src.slice(4));
      slots.push({
        placeholder,
        filename: `inline-image-${index}.png`,
        contentType: "image/png",
        content: Buffer.alloc(0),
        contentId: cid,
      });
      return `<p>${placeholder}</p>`;
    }

    return full;
  });

  return { html: replaced, slots };
}

export function replaceImagePlaceholdersInMarkdown(
  markdown: string,
  placeholderToMarkdown: Map<string, string>,
): string {
  let result = markdown;
  for (const [placeholder, imageMarkdown] of placeholderToMarkdown) {
    result = result.replaceAll(placeholder, imageMarkdown);
  }
  return result;
}

export function extractDataUriImagesFromMarkdown(markdown: string): Array<{
  alt: string;
  dataUri: string;
  contentType: string;
  content: Buffer;
  fullMatch: string;
}> {
  const images: Array<{
    alt: string;
    dataUri: string;
    contentType: string;
    content: Buffer;
    fullMatch: string;
  }> = [];
  const pattern = new RegExp(DATA_URI_IMAGE_MD.source, "gi");
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(markdown)) !== null) {
    index += 1;
    const subtype = match[3] ?? "png";
    const base64 = match[4] ?? "";
    images.push({
      alt: match[1] ?? "",
      dataUri: match[2] ?? "",
      contentType: `image/${subtype}`,
      content: Buffer.from(base64, "base64"),
      fullMatch: match[0],
    });
  }

  return images;
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
  let bodyHtml = typeof html === "string" ? html : null;
  const attachmentImages = extractInlineImages(attachments);
  let inlineImages: EmailInlineImage[] = [];

  if (bodyHtml) {
    const { html, slots } = replaceHtmlImagesWithPlaceholders(bodyHtml);
    bodyHtml = html;
    const usedAttachmentCids = new Set<string>();

    inlineImages = slots.map((slot) => {
      if (slot.contentId) {
        const attachment = attachmentImages.find(
          (image) =>
            image.contentId &&
            normalizeContentId(image.contentId) === slot.contentId,
        );
        if (attachment) {
          usedAttachmentCids.add(slot.contentId);
          return {
            placeholder: slot.placeholder,
            filename: attachment.filename,
            contentType: attachment.contentType,
            content: attachment.content,
            contentId: attachment.contentId,
          };
        }
      }

      return {
        placeholder: slot.placeholder,
        filename: slot.filename,
        contentType: slot.contentType,
        content: slot.content,
        contentId: slot.contentId,
      };
    });

    for (const attachment of attachmentImages) {
      const cid = attachment.contentId
        ? normalizeContentId(attachment.contentId)
        : null;
      if (cid && usedAttachmentCids.has(cid)) continue;
      inlineImages.push({
        ...attachment,
        placeholder: null,
      });
    }
  } else {
    inlineImages = attachmentImages;
  }

  const bodyMarkdown = buildEmailMarkdownBody(plainText, bodyHtml);
  const body = buildEmailPlainBody(plainText, bodyHtml, bodyMarkdown).trim();

  return {
    body,
    bodyMarkdown,
    bodyHtml,
    inlineImages,
  };
}
