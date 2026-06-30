import type { IssueProvider } from "@servicebeard/providers";
import type { ParsedEmail } from "@servicebeard/shared";
import {
  extractDataUriImagesFromMarkdown,
  normalizeContentId,
  replaceCidImagesInMarkdown,
  replaceImagePlaceholdersInMarkdown,
} from "@servicebeard/shared/email-content";
import { logExternalError } from "../lib/external-error";

async function uploadInlineImage(
  provider: IssueProvider,
  filename: string,
  content: Buffer,
  contentType: string,
  projectId?: string,
): Promise<string> {
  try {
    const uploaded = await provider.uploadFile(filename, content, contentType);
    return uploaded.markdown;
  } catch (err) {
    logExternalError("inbound", "upload-inline-image", err, {
      filename,
      projectId,
    });
    throw err;
  }
}

export async function resolveEmailMarkdown(
  email: ParsedEmail,
  provider: IssueProvider,
  projectId?: string,
): Promise<string> {
  let markdown = email.bodyMarkdown || email.body;

  const placeholderToMarkdown = new Map<string, string>();
  const cidToMarkdown = new Map<string, string>();
  const appended: string[] = [];

  for (const image of email.inlineImages) {
    if (image.content.length === 0) continue;

    const uploadedMarkdown = await uploadInlineImage(
      provider,
      image.filename,
      image.content,
      image.contentType,
      projectId,
    );

    if (image.placeholder) {
      placeholderToMarkdown.set(image.placeholder, uploadedMarkdown);
      continue;
    }

    if (image.contentId) {
      cidToMarkdown.set(normalizeContentId(image.contentId), uploadedMarkdown);
      continue;
    }

    appended.push(uploadedMarkdown);
  }

  markdown = replaceImagePlaceholdersInMarkdown(
    markdown,
    placeholderToMarkdown,
  );
  markdown = replaceCidImagesInMarkdown(markdown, cidToMarkdown);

  const dataUriImages = extractDataUriImagesFromMarkdown(markdown);
  for (const [index, image] of dataUriImages.entries()) {
    const uploadedMarkdown = await uploadInlineImage(
      provider,
      `inline-image-${index + 1}.png`,
      image.content,
      image.contentType,
      projectId,
    );
    markdown = markdown.replace(image.fullMatch, uploadedMarkdown);
  }

  if (appended.length > 0) {
    markdown = `${markdown.trim()}\n\n${appended.join("\n\n")}`.trim();
  }

  return markdown;
}
