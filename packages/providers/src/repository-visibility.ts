import { parseGithubRepository } from "@servicebeard/shared";
import { buildTlsOptions } from "./http";
import type { ProviderConfig } from "./types";

export type RepositoryVisibility =
  "public" | "private" | "internal" | "unknown";

export interface LookupRepositoryVisibilityInput {
  provider: "github" | "gitlab";
  baseUrl: string;
  projectId: string;
  tlsInsecure?: boolean;
  caCert?: string | null;
}

function minimalConfig(input: LookupRepositoryVisibilityInput): ProviderConfig {
  return {
    baseUrl: input.baseUrl,
    projectId: input.projectId,
    token: "",
    tlsInsecure: input.tlsInsecure,
    caCert: input.caCert,
  };
}

function githubApiBase(baseUrl: string): string {
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

async function fetchJson(
  config: ProviderConfig,
  url: string,
): Promise<{ ok: boolean; data?: unknown }> {
  const tls = buildTlsOptions(config);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ServiceBeard",
    },
    ...(tls ? { tls } : {}),
  });

  if (!response.ok) {
    return { ok: false };
  }

  return { ok: true, data: await response.json() };
}

async function lookupGithubRepositoryVisibility(
  input: LookupRepositoryVisibilityInput,
): Promise<RepositoryVisibility> {
  let repository: string;
  try {
    repository = parseGithubRepository(input.projectId);
  } catch {
    return "unknown";
  }

  const url = `${githubApiBase(input.baseUrl)}/repos/${repository}`;
  const result = await fetchJson(minimalConfig(input), url);
  if (!result.ok) return "unknown";

  const data = result.data as { private?: boolean };
  if (data.private === false) return "public";
  if (data.private === true) return "private";
  return "unknown";
}

async function lookupGitlabProjectVisibility(
  input: LookupRepositoryVisibilityInput,
): Promise<RepositoryVisibility> {
  const projectId = input.projectId.trim();
  if (!projectId) return "unknown";

  const apiBase = `${input.baseUrl.replace(/\/$/, "")}/api/v4`;
  const url = `${apiBase}/projects/${encodeURIComponent(projectId)}`;
  const result = await fetchJson(minimalConfig(input), url);
  if (!result.ok) return "unknown";

  const data = result.data as { visibility?: string };
  if (data.visibility === "public") return "public";
  if (data.visibility === "internal") return "internal";
  if (data.visibility === "private") return "private";
  return "unknown";
}

export async function lookupRepositoryVisibility(
  input: LookupRepositoryVisibilityInput,
): Promise<RepositoryVisibility> {
  if (input.provider === "github") {
    return lookupGithubRepositoryVisibility(input);
  }
  return lookupGitlabProjectVisibility(input);
}

export function isPublicRepositoryVisibility(
  visibility: RepositoryVisibility,
): boolean {
  return visibility === "public";
}
