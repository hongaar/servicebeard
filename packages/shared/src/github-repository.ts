const GIT_SUFFIX = /\.git$/i;

/**
 * Normalize GitHub repository input to `owner/repo`.
 * Accepts slugs, repository URLs, and issue/pull/etc. URLs on the same repo.
 */
export function parseGithubRepository(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Repository is required");
  }

  const sshMatch = trimmed.match(/^git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch?.[1] && sshMatch[2]) {
    return `${sshMatch[1]}/${sshMatch[2].replace(GIT_SUFFIX, "")}`;
  }

  if (trimmed.includes("://") || /^[^/]+\.[^/]+\//.test(trimmed)) {
    const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try {
      parsed = new URL(withScheme);
    } catch {
      throw new Error(`Invalid GitHub repository URL "${input}"`);
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      throw new Error(`Invalid GitHub repository URL "${input}"`);
    }

    const owner = segments[0]!;
    const repo = segments[1]!.replace(GIT_SUFFIX, "");
    if (!owner || !repo) {
      throw new Error(`Invalid GitHub repository URL "${input}"`);
    }

    return `${owner}/${repo}`;
  }

  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${parts[0]}/${parts[1].replace(GIT_SUFFIX, "")}`;
  }

  throw new Error(
    `Invalid repository format "${input}", expected owner/repo or a GitHub repository URL`,
  );
}

export function looksLikeGithubRepositoryUrl(input: string): boolean {
  const trimmed = input.trim();
  return (
    /^git@[^:]+:/i.test(trimmed) ||
    trimmed.includes("://") ||
    /^github\.com\//i.test(trimmed) ||
    /^www\.github\.com\//i.test(trimmed)
  );
}

export function normalizeProviderProjectId(
  provider: string | undefined,
  projectId: string,
): string {
  const trimmed = projectId.trim();
  if (provider === "github" || looksLikeGithubRepositoryUrl(trimmed)) {
    return parseGithubRepository(trimmed);
  }
  return trimmed;
}
