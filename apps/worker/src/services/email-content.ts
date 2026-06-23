import type { IssueProvider } from "@serviceboard/providers";
import type { ParsedEmail } from "@serviceboard/shared";
import {
    normalizeContentId,
    replaceCidImagesInMarkdown,
} from "@serviceboard/shared/email-content";

export async function resolveEmailMarkdown(
  email: ParsedEmail,
  provider: IssueProvider,
): Promise<string> {
  let markdown = email.bodyMarkdown || email.body;
  if (email.inlineImages.length === 0) return markdown;

  const cidToMarkdown = new Map<string, string>();
  const appended: string[] = [];

  for (const image of email.inlineImages) {
    const uploaded = await provider.uploadFile(
      image.filename,
      image.content,
      image.contentType,
    );

    if (image.contentId) {
      cidToMarkdown.set(normalizeContentId(image.contentId), uploaded.markdown);
      continue;
    }

    appended.push(uploaded.markdown);
  }

  markdown = replaceCidImagesInMarkdown(markdown, cidToMarkdown);

  if (appended.length > 0) {
    markdown = `${markdown.trim()}\n\n${appended.join("\n\n")}`.trim();
  }

  return markdown;
}
