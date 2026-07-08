export function normalizeUploadContent(content: Buffer): Buffer {
  if (Buffer.isBuffer(content)) return content;
  return Buffer.from(content as unknown as Uint8Array);
}

export function assertNonEmptyUpload(
  content: Buffer,
  filename: string,
): Buffer {
  const normalized = normalizeUploadContent(content);
  if (normalized.length === 0) {
    throw new Error(`Cannot upload empty file: ${filename}`);
  }
  return normalized;
}

export function uploadBlob(
  content: Buffer,
  mimeType: string,
): { body: Blob; contentType: string; size: number } {
  const normalized = normalizeUploadContent(content);
  return {
    body: new Blob([new Uint8Array(normalized)], { type: mimeType }),
    contentType: mimeType,
    size: normalized.length,
  };
}

export function inferImageContentTypeFromUrl(url: string): string | null {
  const withoutQuery = url.split("?")[0] ?? url;
  const ext = withoutQuery.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "bmp":
      return "image/bmp";
    default:
      break;
  }

  if (/\/user-attachments\/assets\//i.test(url)) return "image/png";
  if (/user-images\.githubusercontent\.com/i.test(url)) return "image/png";
  if (/uploads\.linear\.app/i.test(url)) return "image/png";

  return null;
}

export function signedUploadHeaders(
  signedHeaders: Array<{ key: string; value: string }>,
  fallbackContentType: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const header of signedHeaders) {
    headers[header.key] = header.value;
  }

  const contentType =
    headers["Content-Type"] ?? headers["content-type"] ?? fallbackContentType;
  headers["Content-Type"] = contentType;
  delete headers["content-type"];

  return headers;
}
