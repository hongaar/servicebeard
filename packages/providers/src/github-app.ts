import { resolveMonorepoPath } from "@servicebeard/shared/env";
import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { ProviderApiError } from "./errors";
import { providerFetch } from "./http";
import type { ProviderConfig } from "./types";

interface GithubAppConfig {
  appId: string;
  privateKey: string;
}

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

interface GithubAppResponse {
  slug: string;
  name: string;
}

interface GithubUserResponse {
  id: number;
  login: string;
  name?: string | null;
  type?: string;
}

const installationTokenCache = new Map<
  string,
  { token: string; expiresAtMs: number }
>();

export function isGithubAppEnabled(): boolean {
  return Boolean(process.env.GITHUB_APP_ID?.trim());
}

export function isGithubAppConfigured(): boolean {
  return isGithubAppEnabled() && Boolean(readGithubAppPrivateKey());
}

function readGithubAppPrivateKey(): string | null {
  const inline = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (inline) return inline.replace(/\\n/g, "\n");

  const path = process.env.GITHUB_APP_PRIVATE_KEY_PATH?.trim();
  if (!path) return null;
  const resolved = resolveMonorepoPath(path);
  if (!existsSync(resolved)) return null;
  return readFileSync(resolved, "utf8");
}

function getGithubAppConfig(): GithubAppConfig {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const privateKey = readGithubAppPrivateKey();
  if (!appId || !privateKey) {
    throw new Error(
      "GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY (or GITHUB_APP_PRIVATE_KEY_PATH).",
    );
  }
  return { appId, privateKey };
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createGithubAppJwt(
  appId: string,
  privateKeyPem: string,
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: appId,
    }),
  );
  const data = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256")
    .update(data)
    .sign(privateKeyPem, "base64url");
  return `${data}.${signature}`;
}

function cacheKey(baseUrl: string, installationId: string): string {
  return `${baseUrl.replace(/\/$/, "")}:${installationId}`;
}

async function githubAppRequest<T>(
  baseUrl: string,
  path: string,
  jwt: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${apiBaseForApp(baseUrl)}${path}`;
  const response = await providerFetch(
    { baseUrl, projectId: "", token: jwt },
    url,
    {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "User-Agent": "servicebeard",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.headers as Record<string, string> | undefined),
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ProviderApiError(
      response.status,
      `GitHub App API error ${response.status}: ${text}`,
      "GitHubAppApiError",
      text,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function apiBaseForApp(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, "");
  try {
    if (new URL(normalized).hostname === "github.com") {
      return "https://api.github.com";
    }
  } catch {
    // fall through
  }
  return `${normalized}/api/v3`;
}

const appSlugCache = new Map<string, { slug: string; fetchedAtMs: number }>();

export async function getGithubAppSlug(baseUrl: string): Promise<string> {
  const key = baseUrl.replace(/\/$/, "");
  const cached = appSlugCache.get(key);
  if (cached && cached.fetchedAtMs > Date.now() - 3_600_000) {
    return cached.slug;
  }

  const { appId, privateKey } = getGithubAppConfig();
  const jwt = createGithubAppJwt(appId, privateKey);
  const app = await githubAppRequest<GithubAppResponse>(baseUrl, "/app", jwt);
  appSlugCache.set(key, { slug: app.slug, fetchedAtMs: Date.now() });
  return app.slug;
}

export function buildGithubAppInstallUrl(
  baseUrl: string,
  slug: string,
  state: string,
): string {
  const normalized = baseUrl.replace(/\/$/, "");
  let host = "github.com";
  try {
    host = new URL(normalized).hostname;
  } catch {
    // fall through
  }

  const encodedState = encodeURIComponent(state);
  const encodedSlug = encodeURIComponent(slug);
  if (host === "github.com") {
    return `https://github.com/apps/${encodedSlug}/installations/new?state=${encodedState}`;
  }
  return `${normalized}/github/apps/${encodedSlug}/installations/new?state=${encodedState}`;
}

export function buildGithubAppInstallationSettingsUrl(
  baseUrl: string,
  installationId: string,
): string {
  const normalized = baseUrl.replace(/\/$/, "");
  try {
    if (new URL(normalized).hostname === "github.com") {
      return `https://github.com/settings/installations/${encodeURIComponent(installationId)}`;
    }
  } catch {
    // fall through
  }
  return `${normalized}/settings/installations/${encodeURIComponent(installationId)}`;
}

interface RepositoryInstallationResponse {
  id: number;
  account?: { login?: string };
}

export async function getRepositoryInstallation(
  baseUrl: string,
  repository: string,
): Promise<{ installationId: string; accountLogin: string | null } | null> {
  const parts = repository.trim().split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const { appId, privateKey } = getGithubAppConfig();
  const jwt = createGithubAppJwt(appId, privateKey);

  try {
    const data = await githubAppRequest<RepositoryInstallationResponse>(
      baseUrl,
      `/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/installation`,
      jwt,
    );
    return {
      installationId: String(data.id),
      accountLogin: data.account?.login ?? null,
    };
  } catch (err) {
    if (err instanceof ProviderApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getGithubInstallationAccessToken(
  baseUrl: string,
  installationId: string,
): Promise<string> {
  const key = cacheKey(baseUrl, installationId);
  const cached = installationTokenCache.get(key);
  if (cached && cached.expiresAtMs > Date.now() + 60_000) {
    return cached.token;
  }

  const { appId, privateKey } = getGithubAppConfig();
  const jwt = createGithubAppJwt(appId, privateKey);
  const data = await githubAppRequest<InstallationTokenResponse>(
    baseUrl,
    `/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    jwt,
    { method: "POST" },
  );

  installationTokenCache.set(key, {
    token: data.token,
    expiresAtMs: new Date(data.expires_at).getTime(),
  });

  return data.token;
}

export async function getGithubAppBotUser(
  baseUrl: string,
  installationId: string,
): Promise<{ id: string; username: string }> {
  const { appId, privateKey } = getGithubAppConfig();
  const jwt = createGithubAppJwt(appId, privateKey);
  const app = await githubAppRequest<GithubAppResponse>(baseUrl, "/app", jwt);
  const botLogin = `${app.slug}[bot]`;

  const installationToken = await getGithubInstallationAccessToken(
    baseUrl,
    installationId,
  );
  const url = `${apiBaseForApp(baseUrl)}/users/${encodeURIComponent(botLogin)}`;
  const response = await providerFetch(
    { baseUrl, projectId: "", token: installationToken },
    url,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${installationToken}`,
        "User-Agent": "servicebeard",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ProviderApiError(
      response.status,
      `GitHub App bot user lookup failed ${response.status}: ${text}`,
      "GitHubAppApiError",
      text,
    );
  }

  const user = (await response.json()) as GithubUserResponse;
  return { id: String(user.id), username: user.login };
}

export async function resolveGithubAccessToken(
  config: ProviderConfig,
): Promise<string> {
  if (config.githubInstallationId) {
    return getGithubInstallationAccessToken(
      config.baseUrl,
      config.githubInstallationId,
    );
  }
  return config.token;
}
