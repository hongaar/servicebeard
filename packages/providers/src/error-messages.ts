export function parseErrorResponseBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed) as {
        message?: string;
        errors?: Array<{ message?: string; code?: string }>;
      };
      if (typeof json.message === "string" && json.message.trim()) {
        return json.message.trim();
      }
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        return json.errors
          .map((error) => error.message ?? error.code)
          .filter(Boolean)
          .join("; ");
      }
    } catch {
      // fall through
    }
  }

  if (trimmed.startsWith("<")) {
    const code = trimmed.match(/<Code>([^<]+)<\/Code>/i)?.[1];
    const message = trimmed.match(/<Message>([^<]+)<\/Message>/i)?.[1];
    const details = trimmed.match(/<Details>([^<]+)<\/Details>/i)?.[1];
    const parameter = trimmed.match(
      /<ParameterName>([^<]+)<\/ParameterName>/i,
    )?.[1];
    const parts = [
      code,
      message,
      details,
      parameter ? `header: ${parameter}` : null,
    ]
      .filter(Boolean)
      .map((part) => part!.trim());
    if (parts.length > 0) return parts.join(": ");
  }

  return truncate(trimmed);
}

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function integrationAccessMessage(detail: string | null): string | null {
  if (detail === "Resource not accessible by integration") {
    return "the GitHub App needs Contents read/write permission on the repository (reinstall the app after updating permissions)";
  }
  return null;
}

export function githubApiErrorMessage(
  status: number,
  path: string,
  body: string,
): string {
  const detail = parseErrorResponseBody(body);
  const integration = integrationAccessMessage(detail);
  if (integration) {
    return `GitHub API request failed (HTTP ${status}) on ${path}: ${integration}`;
  }
  if (status === 422 && detail === "Bad Size") {
    return "GitHub rejected the image upload because the file size metadata was missing or invalid";
  }
  if (detail) {
    return `GitHub API request failed (HTTP ${status}) on ${path}: ${detail}`;
  }
  return `GitHub API request failed (HTTP ${status}) on ${path}`;
}

export function githubUploadErrorMessage(status: number, body: string): string {
  const detail = parseErrorResponseBody(body);
  if (status === 422 && detail === "Bad Size") {
    return "GitHub rejected the image upload because the file size metadata was missing or invalid";
  }
  if (status === 404 && detail === "Not found") {
    return "GitHub rejected the image upload because repository contents access is unavailable for this token";
  }
  if (detail) {
    return `GitHub image upload failed (HTTP ${status}): ${detail}`;
  }
  return `GitHub image upload failed (HTTP ${status})`;
}

export function gitlabApiErrorMessage(
  status: number,
  path: string,
  body: string,
): string {
  const detail = parseErrorResponseBody(body);
  if (detail) {
    return `GitLab API request failed (HTTP ${status}) on ${path}: ${detail}`;
  }
  return `GitLab API request failed (HTTP ${status}) on ${path}`;
}

export function gitlabUploadErrorMessage(status: number, body: string): string {
  const detail = parseErrorResponseBody(body);
  if (detail) {
    return `GitLab file upload failed (HTTP ${status}): ${detail}`;
  }
  return `GitLab file upload failed (HTTP ${status})`;
}

export function linearApiErrorMessage(status: number, body: string): string {
  const detail = parseErrorResponseBody(body);
  if (detail) {
    return `Linear API request failed (HTTP ${status}): ${detail}`;
  }
  return `Linear API request failed (HTTP ${status})`;
}

export function linearUploadErrorMessage(status: number, body: string): string {
  const detail = parseErrorResponseBody(body);
  if (status === 400 && detail?.includes("MalformedSecurityHeader")) {
    return "Linear image upload failed because the storage upload was missing a required Content-Type header";
  }
  if (detail) {
    return `Linear image upload failed (HTTP ${status}): ${detail}`;
  }
  return `Linear image upload failed (HTTP ${status})`;
}
