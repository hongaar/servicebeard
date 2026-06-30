import { DEFAULT_API_URL, SESSION_COOKIE } from "./constants";

export interface ApiResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
  raw: Response;
}

export interface ApiClientOptions {
  baseUrl?: string;
  sessionToken?: string;
}

function parseJsonBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  opts: ApiClientOptions = {},
): Promise<ApiResponse> {
  const baseUrl = (
    opts.baseUrl ??
    process.env.API_URL ??
    DEFAULT_API_URL
  ).replace(/\/$/, "");
  const headers = new Headers(init.headers);

  if (opts.sessionToken) {
    headers.set("Cookie", `${SESSION_COOKIE}=${opts.sessionToken}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: parseJsonBody(text),
    raw: response,
  };
}

export function createApiClient(sessionToken?: string, baseUrl?: string) {
  return {
    get: (path: string, init?: RequestInit) =>
      apiFetch(path, { ...init, method: "GET" }, { sessionToken, baseUrl }),
    post: (path: string, body?: unknown, init?: RequestInit) =>
      apiFetch(
        path,
        {
          ...init,
          method: "POST",
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        { sessionToken, baseUrl },
      ),
    patch: (path: string, body?: unknown, init?: RequestInit) =>
      apiFetch(
        path,
        {
          ...init,
          method: "PATCH",
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        { sessionToken, baseUrl },
      ),
    delete: (path: string, init?: RequestInit) =>
      apiFetch(path, { ...init, method: "DELETE" }, { sessionToken, baseUrl }),
  };
}
