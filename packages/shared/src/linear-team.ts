const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LINEAR_PROJECT_PREFIX = "project:";
export const LINEAR_TEAM_PREFIX = "team:";

export function looksLikeLinearTeamUrl(input: string): boolean {
  return /linear\.app/i.test(input);
}

export function isLinearProjectId(value: string): boolean {
  return value.startsWith(LINEAR_PROJECT_PREFIX);
}

export function isLinearTeamId(value: string): boolean {
  return value.startsWith(LINEAR_TEAM_PREFIX);
}

export function parseLinearProjectSlugId(slug: string): string {
  const match = slug.match(/-([a-f0-9]{12})$/i);
  return match?.[1] ?? slug;
}

/** Strip Linear's trailing slug id suffix for display (e.g. `my-project-a1b2c3d4e5f6` → `my-project`). */
export function linearSlugDisplayName(slug: string): string {
  return slug.replace(/-[a-f0-9]{12}$/i, "");
}

/** Parse workspace slug from a linear.app project or team URL. */
export function linearWorkspaceFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const workspace = segments[0];
    if (
      workspace &&
      workspace !== "project" &&
      workspace !== "issue" &&
      workspace !== "team" &&
      workspace !== "settings"
    ) {
      return workspace;
    }
  } catch {
    // ignore invalid URLs
  }
  return undefined;
}

/**
 * Normalize Linear team or project input to a team UUID, team key, or `project:…` id.
 */
export function parseLinearTeam(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Team or project is required");
  }

  if (isLinearProjectId(trimmed)) {
    const ref = trimmed.slice(LINEAR_PROJECT_PREFIX.length).trim();
    if (!ref) {
      throw new Error("Linear project reference is required");
    }
    return `${LINEAR_PROJECT_PREFIX}${ref}`;
  }

  if (isLinearTeamId(trimmed)) {
    const ref = trimmed.slice(LINEAR_TEAM_PREFIX.length).trim();
    if (!ref) {
      throw new Error("Linear team reference is required");
    }
    return `${LINEAR_TEAM_PREFIX}${ref}`;
  }

  if (UUID_RE.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes("://") || looksLikeLinearTeamUrl(trimmed)) {
    const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try {
      parsed = new URL(withScheme);
    } catch {
      throw new Error(`Invalid Linear URL "${input}"`);
    }

    if (!parsed.hostname.toLowerCase().includes("linear.app")) {
      throw new Error(`Invalid Linear URL "${input}"`);
    }

    const projectPathMatch = parsed.pathname.match(/\/project\/([^/]+)/i);
    if (projectPathMatch?.[1]) {
      const slug = decodeURIComponent(projectPathMatch[1]);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const workspace = segments[0];
      if (
        workspace &&
        workspace !== "project" &&
        workspace !== "issue" &&
        workspace !== "team"
      ) {
        return `${LINEAR_PROJECT_PREFIX}${workspace}/${slug}`;
      }
      return `${LINEAR_PROJECT_PREFIX}${slug}`;
    }

    const teamPathMatch = parsed.pathname.match(/\/team\/([^/]+)/i);
    if (teamPathMatch?.[1]) {
      const teamRef = decodeURIComponent(teamPathMatch[1]);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const workspace = segments[0];
      if (
        workspace &&
        workspace !== "project" &&
        workspace !== "issue" &&
        workspace !== "team"
      ) {
        return `${LINEAR_TEAM_PREFIX}${workspace}/${teamRef}`;
      }
      return teamRef;
    }

    const issuePathMatch = parsed.pathname.match(/\/issue\/([A-Za-z0-9]+)-\d+/);
    if (issuePathMatch?.[1]) {
      return issuePathMatch[1];
    }

    const settingsMatch = parsed.pathname.match(
      /\/settings\/teams\/([0-9a-f-]{36})/i,
    );
    if (settingsMatch?.[1]) {
      return settingsMatch[1];
    }

    throw new Error(`Invalid Linear URL "${input}"`);
  }

  if (/^[A-Za-z0-9_-]{1,64}$/.test(trimmed)) {
    return trimmed;
  }

  throw new Error(
    `Invalid format "${input}", expected team UUID, team key, project URL, or a Linear team/project URL`,
  );
}

export function parseLinearIssueNumberFromUrl(
  url: string | undefined,
): number | null {
  if (!url) return null;
  const match = url.match(/\/issue\/[A-Za-z0-9]+-(\d+)/);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}
