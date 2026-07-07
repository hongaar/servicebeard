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
