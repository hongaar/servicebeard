import {
  extensionGlobalSearchGroups,
  extensionTeamNavItems,
} from "@extensions";
import { DOC_PATHS } from "./docs";
import {
  PROJECT_SECTION_LABELS,
  type NavIconKey,
  type ProjectSection,
} from "./navigation";

export interface GlobalSearchContext {
  teamId?: string;
  teamName?: string;
  projectId?: string;
  projectName?: string;
  section?: ProjectSection;
  isAdmin?: boolean;
}

export type GlobalSearchActionKind = "navigate" | "external";

export interface GlobalSearchAction {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  group: string;
  kind: GlobalSearchActionKind;
  to: string;
  params?: Record<string, string>;
  icon?: NavIconKey;
}

export interface GlobalSearchResultItem {
  id: string;
  label: string;
  description?: string;
  group: string;
  icon?: NavIconKey;
  kind: GlobalSearchActionKind;
  to: string;
  params?: Record<string, string>;
}

export function filterSearchActions(
  actions: GlobalSearchAction[],
  query: string,
): GlobalSearchAction[] {
  const q = query.trim().toLowerCase();
  if (!q) return actions;

  return actions.filter((action) => {
    const haystack = [
      action.label,
      action.description,
      ...(action.keywords ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function buildSearchActions(
  context: GlobalSearchContext,
): GlobalSearchAction[] {
  const { teamId, projectId, isAdmin } = context;
  const actions: GlobalSearchAction[] = [
    {
      id: "nav-teams",
      label: "Teams",
      description: "Your teams dashboard",
      keywords: ["home", "dashboard"],
      group: "Navigation",
      kind: "navigate",
      to: "/",
      icon: "teams",
    },
    {
      id: "nav-account",
      label: "Account",
      description: "Profile and connected sign-in providers",
      keywords: [
        "profile",
        "user",
        "settings",
        "providers",
        "password",
        "passkey",
        "sso",
      ],
      group: "Navigation",
      kind: "navigate",
      to: "/account",
      icon: "account",
    },
    {
      id: "help-docs",
      label: "Help & documentation",
      description: "Product guides and setup help",
      keywords: ["help", "docs", "guide", "support", "contact"],
      group: "Help",
      kind: "navigate",
      to: DOC_PATHS.index,
    },
    {
      id: "help-mailbox",
      label: "Mailbox setup guide",
      keywords: ["imap", "smtp", "mail", "email"],
      group: "Help",
      kind: "navigate",
      to: DOC_PATHS.mailbox,
    },
    {
      id: "help-providers",
      label: "Issue provider setup",
      keywords: ["gitlab", "github", "linear", "issues"],
      group: "Help",
      kind: "navigate",
      to: DOC_PATHS.issueProviders,
    },
    {
      id: "help-self-host",
      label: "Self-hosting guide",
      keywords: ["deploy", "docker", "helm"],
      group: "Help",
      kind: "navigate",
      to: DOC_PATHS.selfHost,
    },
  ];

  if (isAdmin) {
    actions.push(
      {
        id: "nav-admin-overview",
        label: "Admin overview",
        description: "Platform-wide teams and projects overview",
        keywords: ["admin", "teams", "projects", "overview"],
        group: "Admin",
        kind: "navigate",
        to: "/admin",
        icon: "adminOverview",
      },
      {
        id: "nav-admin-health",
        label: "System health",
        description: "Health checks and service connectivity",
        keywords: ["admin", "health", "connectivity", "services"],
        group: "Admin",
        kind: "navigate",
        to: "/admin/health",
        icon: "adminHealth",
      },
      {
        id: "nav-admin-project-status",
        label: "Project status",
        description: "Mailbox and issue provider sync events across projects",
        keywords: ["admin", "sync", "errors", "status", "projects"],
        group: "Admin",
        kind: "navigate",
        to: "/admin/project-status",
        icon: "adminProjectStatus",
      },
      {
        id: "nav-admin-audit-log",
        label: "Audit log",
        description: "Platform activity and billing events",
        keywords: ["admin", "audit", "log", "billing", "activity"],
        group: "Admin",
        kind: "navigate",
        to: "/admin/audit-log",
        icon: "adminAuditLog",
      },
      {
        id: "nav-admin-job-runs",
        label: "Job runs",
        description: "Worker execution history for polls and outbound email",
        keywords: ["admin", "worker", "jobs", "poll", "queue"],
        group: "Admin",
        kind: "navigate",
        to: "/admin/job-runs",
        icon: "adminJobRuns",
      },
    );
  }

  if (teamId) {
    actions.push(
      {
        id: "nav-projects",
        label: "Projects",
        description: context.teamName
          ? `${context.teamName} projects`
          : undefined,
        keywords: ["project", "mailbox"],
        group: "Navigation",
        kind: "navigate",
        to: "/teams/$teamId/projects",
        params: { teamId },
        icon: "projects",
      },
      {
        id: "nav-members",
        label: "Members",
        description: context.teamName
          ? `${context.teamName} members`
          : undefined,
        keywords: ["people", "invite", "users"],
        group: "Navigation",
        kind: "navigate",
        to: "/teams/$teamId/members",
        params: { teamId },
        icon: "members",
      },
      {
        id: "nav-team-settings",
        label: "Team settings",
        keywords: ["settings", "rename", "delete team"],
        group: "Navigation",
        kind: "navigate",
        to: "/teams/$teamId/settings",
        params: { teamId },
        icon: "teamSettings",
      },
    );

    for (const item of extensionTeamNavItems(teamId)) {
      if (item.visible === false) continue;
      actions.push({
        id: `ext-${item.to}`,
        label: item.label,
        group: "Navigation",
        kind: "navigate",
        to: item.to,
        params: item.params ?? { teamId },
        icon: item.searchIcon,
      });
    }
  }

  if (teamId && projectId) {
    const sections = [
      ["overview", "overview"],
      ["rules", "rules"],
      ["conversations", "conversations", "threads", "inbox"],
      ["status", "status", "errors", "sync"],
      ["templates", "templates", "email"],
      ["settings", "settings", "project settings"],
    ] as const;

    for (const [key, ...keywords] of sections) {
      actions.push({
        id: `nav-project-${key}`,
        label: PROJECT_SECTION_LABELS[key],
        description: context.projectName
          ? `${context.projectName} · ${PROJECT_SECTION_LABELS[key]}`
          : undefined,
        keywords: [...keywords],
        group: "Project",
        kind: "navigate",
        to: "/teams/$teamId/projects/$projectId/$section",
        params: { teamId, projectId, section: key },
        icon: key,
      });
    }
  }

  for (const { label, actions: groupActions } of extensionGlobalSearchGroups(
    context,
  )) {
    for (const action of groupActions) {
      actions.push({ ...action, group: label });
    }
  }

  return actions;
}

export function searchActionsToItems(
  actions: GlobalSearchAction[],
): GlobalSearchResultItem[] {
  return actions.map((action) => ({
    id: action.id,
    label: action.label,
    description: action.description,
    group: action.group,
    icon: action.icon,
    kind: action.kind,
    to: action.to,
    params: action.params,
  }));
}
