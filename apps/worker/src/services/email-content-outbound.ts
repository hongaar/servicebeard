import type { ProviderConfig } from "@serviceboard/providers";
import { providerFetch } from "@serviceboard/providers";
import {
    extractMarkdownImages,
    markdownToHtml,
    markdownToPlainText,
    replaceHtmlImageUrlsWithCid,
    replaceMarkdownImagesWithCid,
} from "@serviceboard/shared/email-content";
import { randomBytes } from "node:crypto";

export interface OutboundMultipartContent {
  text: string;
  html: string;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    cid: string;
  }>;
}

function filenameFromUrl(url: string, index: number): string {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop();
    if (base) return base;
  } catch {
    // fall through
  }
  return `image-${index + 1}.png`;
}

function isFetchableImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export async function buildOutboundMultipartContent(
  markdown: string,
  providerConfig?: ProviderConfig,
): Promise<OutboundMultipartContent> {
  const images = extractMarkdownImages(markdown).filter((image) =>
    isFetchableImageUrl(image.url),
  );

  if (images.length === 0) {
    return {
      text: markdownToPlainText(markdown),
      html: markdownToHtml(markdown),
      attachments: [],
    };
  }

  const urlToCid = new Map<string, string>();
  const attachments: OutboundMultipartContent["attachments"] = [];

  for (const [index, image] of images.entries()) {
    if (urlToCid.has(image.url)) continue;

    try {
      const response = providerConfig
        ? await providerFetch(providerConfig, image.url)
        : await fetch(image.url);
      if (!response.ok) continue;

      const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";
      if (!contentType.toLowerCase().startsWith("image/")) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      const cid = `${randomBytes(8).toString("hex")}@serviceboard.local`;
      urlToCid.set(image.url, cid);
      attachments.push({
        filename: filenameFromUrl(image.url, index),
        content: buffer,
        contentType,
        cid,
      });
    } catch {
      // Keep remote URL when fetch fails.
    }
  }

  const markdownWithCid = replaceMarkdownImagesWithCid(markdown, urlToCid);
  const html = replaceHtmlImageUrlsWithCid(
    markdownToHtml(markdownWithCid),
    urlToCid,
  );

  return {
    text: markdownToPlainText(markdownWithCid),
    html,
    attachments,
  };
}
