import {
  isLinearProjectId,
  isLinearTeamId,
  LINEAR_PROJECT_PREFIX,
  LINEAR_TEAM_PREFIX,
  linearSlugDisplayName,
} from "./linear-team";

export type ProviderProjectKind = "team" | "project";

export interface ProviderProjectLabel {
  label: string;
  kind?: ProviderProjectKind;
  workspace?: string;
}

function linearNamespaceLabel(
  workspace: string | undefined,
  name: string,
  kind: ProviderProjectKind,
): ProviderProjectLabel {
  return {
    kind,
    workspace,
    label: workspace ? `${workspace}/${name}` : name,
  };
}

function formatLinearProviderProjectLabel(
  providerProjectId: string,
): ProviderProjectLabel {
  const id = providerProjectId.trim();

  if (isLinearProjectId(id)) {
    const ref = id.slice(LINEAR_PROJECT_PREFIX.length).trim();
    if (ref.includes("/")) {
      const [workspace, slug] = ref.split("/", 2);
      return linearNamespaceLabel(
        workspace,
        linearSlugDisplayName(slug),
        "project",
      );
    }
    return {
      kind: "project",
      label: linearSlugDisplayName(ref),
    };
  }

  if (isLinearTeamId(id)) {
    const ref = id.slice(LINEAR_TEAM_PREFIX.length).trim();
    if (ref.includes("/")) {
      const [workspace, teamRef] = ref.split("/", 2);
      return linearNamespaceLabel(workspace, teamRef, "team");
    }
    return { kind: "team", label: ref };
  }

  return { kind: "team", label: id };
}

/**
 * Human-readable label for a linked issue repository (GitHub org/repo, GitLab group/project, Linear workspace/team|project).
 */
export function formatProviderProjectLabel(
  provider: string,
  providerProjectId: string,
): ProviderProjectLabel {
  const id = providerProjectId.trim();
  if (!id) {
    return { label: "" };
  }

  if (provider.toLowerCase() === "linear") {
    return formatLinearProviderProjectLabel(id);
  }

  return { label: id };
}
