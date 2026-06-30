import { parseGithubRepository } from "./github-repository";
import {
  isLinearProjectId,
  LINEAR_PROJECT_PREFIX,
  parseLinearTeam,
} from "./linear-team";

export type IssueProviderType = "github" | "gitlab" | "linear";

export interface DetectedIssueRepository {
  provider: IssueProviderType;
  providerBaseUrl: string;
  providerProjectId: string;
}

const GIT_SUFFIX = /\.git$/i;

function originFromUrl(url: URL): string {
  return `${url.protocol}//${url.host}`;
}

function stripGitlabMetadataPath(pathname: string): string {
  const trimmed = pathname.replace(/^\//, "");
  const beforeMeta = trimmed.split("/-/")[0] ?? trimmed;
  return beforeMeta.replace(GIT_SUFFIX, "");
}

/**
 * Normalize GitLab project input to a numeric ID or `group/project` path.
 */
export function parseGitlabProject(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Project is required");
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  const sshMatch = trimmed.match(/^git@[^:]+:(.+)$/i);
  if (sshMatch?.[1]) {
    const path = sshMatch[1].replace(GIT_SUFFIX, "");
    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2) {
      throw new Error(`Invalid GitLab project path "${input}"`);
    }
    return segments.join("/");
  }

  if (trimmed.includes("://") || /^[^/]+\.[^/]+\//.test(trimmed)) {
    const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try {
      parsed = new URL(withScheme);
    } catch {
      throw new Error(`Invalid GitLab project URL "${input}"`);
    }

    const projectsMatch = parsed.pathname.match(/^\/projects\/(\d+)\/?$/i);
    if (projectsMatch?.[1]) {
      return projectsMatch[1];
    }

    const path = stripGitlabMetadataPath(parsed.pathname);
    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2) {
      throw new Error(`Invalid GitLab project URL "${input}"`);
    }
    return segments.join("/");
  }

  const path = trimmed.replace(GIT_SUFFIX, "");
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 2) {
    return segments.join("/");
  }

  throw new Error(
    `Invalid project format "${input}", expected numeric ID, group/project, or a GitLab project URL`,
  );
}

/** Browser URL for the issues list on a linked GitHub repository or GitLab project. */
export function providerIssuesWebUrl(
  provider: string,
  baseUrl: string,
  providerProjectId: string,
): string {
  const origin = baseUrl.replace(/\/$/, "");
  const projectId = providerProjectId.trim();
  const normalized = provider.toLowerCase();

  if (normalized === "gitlab") {
    if (/^\d+$/.test(projectId)) {
      return `${origin}/projects/${projectId}/issues`;
    }
    return `${origin}/${projectId}/-/issues`;
  }

  if (normalized === "linear") {
    if (isLinearProjectId(projectId)) {
      const ref = projectId.slice(LINEAR_PROJECT_PREFIX.length);
      if (ref.includes("/")) {
        const [workspace, slug] = ref.split("/", 2);
        return `https://linear.app/${workspace}/project/${slug}/issues`;
      }
      return `https://linear.app/project/${ref}/issues`;
    }
    return `https://linear.app/team/${encodeURIComponent(projectId)}/active`;
  }

  return `${origin}/${projectId}/issues`;
}

function detectFromLinear(
  input: string,
  baseUrl: string,
): DetectedIssueRepository | null {
  try {
    return {
      provider: "linear",
      providerBaseUrl: baseUrl.replace(/\/$/, ""),
      providerProjectId: parseLinearTeam(input),
    };
  } catch {
    return null;
  }
}

function hostLooksLikeLinear(host: string): boolean {
  return host === "linear.app" || host === "www.linear.app";
}

function detectFromGithub(
  input: string,
  baseUrl: string,
): DetectedIssueRepository | null {
  try {
    return {
      provider: "github",
      providerBaseUrl: baseUrl.replace(/\/$/, ""),
      providerProjectId: parseGithubRepository(input),
    };
  } catch {
    return null;
  }
}

function detectFromGitlab(
  input: string,
  baseUrl: string,
): DetectedIssueRepository | null {
  try {
    return {
      provider: "gitlab",
      providerBaseUrl: baseUrl.replace(/\/$/, ""),
      providerProjectId: parseGitlabProject(input),
    };
  } catch {
    return null;
  }
}

function hostLooksLikeGithub(host: string): boolean {
  return (
    host === "github.com" ||
    host === "www.github.com" ||
    host.includes("github")
  );
}

function hostLooksLikeGitlab(host: string): boolean {
  return (
    host === "gitlab.com" ||
    host === "www.gitlab.com" ||
    host.includes("gitlab")
  );
}

/**
 * Infer issue provider, instance URL, and project/repository id from a pasted URL or path.
 */
export function detectIssueProviderFromUrl(
  input: string,
): DetectedIssueRepository | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const sshMatch = trimmed.match(/^git@([^:]+):(.+)$/i);
  if (sshMatch?.[1] && sshMatch[2]) {
    const host = sshMatch[1].toLowerCase();
    const path = sshMatch[2];
    const baseUrl = `https://${host}`;
    if (host === "github.com" || hostLooksLikeGithub(host)) {
      return detectFromGithub(`https://${host}/${path}`, baseUrl);
    }
    if (host === "gitlab.com" || hostLooksLikeGitlab(host)) {
      return detectFromGitlab(`https://${host}/${path}`, baseUrl);
    }
    return null;
  }

  if (!trimmed.includes("://") && !/^[^/]+\.[^/]+\//.test(trimmed)) {
    return null;
  }

  const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const baseUrl = originFromUrl(parsed);

  if (hostLooksLikeLinear(host)) {
    return detectFromLinear(trimmed, baseUrl);
  }

  if (hostLooksLikeGithub(host) && !hostLooksLikeGitlab(host)) {
    return detectFromGithub(trimmed, baseUrl);
  }
  if (hostLooksLikeGitlab(host)) {
    return detectFromGitlab(trimmed, baseUrl);
  }

  return null;
}
