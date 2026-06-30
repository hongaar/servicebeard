import type { IssueProvider, ProviderConfig } from "@servicebeard/providers";
import {
  collectOutboundImageRefs,
  markdownToHtml,
  markdownToPlainText,
  prepareGitLabNoteForOutboundEmail,
  replaceHtmlImageUrlsWithCid,
  replaceMarkdownImagesWithCid,
  resolveProviderImageUrl,
} from "@servicebeard/shared/email-content";
import { randomBytes } from "node:crypto";
import { logExternalError } from "../lib/external-error";
import { logger } from "../lib/logger";

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
    const base = url.split("/").pop();
    if (base) return base;
  }
  return `image-${index + 1}.png`;
}

function registerImageCid(
  urlToCid: Map<string, string>,
  originalUrl: string,
  resolvedUrl: string,
  cid: string,
): void {
  urlToCid.set(originalUrl, cid);
  urlToCid.set(resolvedUrl, cid);
  if (originalUrl !== resolvedUrl) {
    urlToCid.set(originalUrl.replace(/^\//, ""), cid);
  }
}

export async function buildOutboundMultipartContent(
  markdown: string,
  provider?: IssueProvider,
  providerConfig?: ProviderConfig,
): Promise<OutboundMultipartContent> {
  const baseUrl = providerConfig?.baseUrl ?? "";
  const preparedMarkdown = prepareGitLabNoteForOutboundEmail(markdown);
  const images = collectOutboundImageRefs(preparedMarkdown, baseUrl);

  if (images.length === 0) {
    return {
      text: markdownToPlainText(preparedMarkdown),
      html: markdownToHtml(preparedMarkdown),
      attachments: [],
    };
  }

  const urlToCid = new Map<string, string>();
  const attachments: OutboundMultipartContent["attachments"] = [];

  for (const [index, image] of images.entries()) {
    const resolvedUrl = resolveProviderImageUrl(image.url, baseUrl);
    if (!resolvedUrl) continue;
    if (urlToCid.has(image.url) || urlToCid.has(resolvedUrl)) continue;

    try {
      const downloaded = provider
        ? await provider.downloadFile(resolvedUrl)
        : await downloadFileAnonymously(resolvedUrl);
      if (!downloaded) {
        logger.warn(
          { url: resolvedUrl, originalUrl: image.url },
          "skipping outbound email image, download failed",
        );
        continue;
      }

      const cid = `${randomBytes(8).toString("hex")}@servicebeard.local`;
      registerImageCid(urlToCid, image.url, resolvedUrl, cid);
      attachments.push({
        filename: filenameFromUrl(resolvedUrl, index),
        content: downloaded.content,
        contentType: downloaded.contentType,
        cid,
      });
    } catch (err) {
      logExternalError("outbound-email", "download-image", err, {
        url: resolvedUrl,
        originalUrl: image.url,
      });
    }
  }

  const markdownWithCid = replaceMarkdownImagesWithCid(
    preparedMarkdown,
    urlToCid,
    baseUrl,
  );
  const html = replaceHtmlImageUrlsWithCid(
    markdownToHtml(markdownWithCid),
    urlToCid,
    baseUrl,
  );

  return {
    text: markdownToPlainText(markdownWithCid),
    html,
    attachments,
  };
}

async function downloadFileAnonymously(
  url: string,
): Promise<{ content: Buffer; contentType: string } | null> {
  const response = await fetch(url);
  if (!response.ok) {
    logger.warn(
      { url, status: response.status },
      "failed to download outbound email image",
    );
    return null;
  }

  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  if (contentType.toLowerCase().includes("text/html")) return null;

  return {
    content: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
}
