import { extensionGlobalSearchGroupOrder } from "@extensions";
import type { GlobalSearchResponse } from "../lib/api";
import type { GlobalSearchResultItem } from "./globalSearch";

export function apiResultsToItems(data: GlobalSearchResponse): GlobalSearchResultItem[] {
  const items: GlobalSearchResultItem[] = [];

  for (const team of data.teams) {
    items.push({
      id: `team-${team.id}`,
      label: team.name,
      group: "Teams",
      icon: "team",
      kind: "navigate",
      to: "/teams/$teamId/projects",
      params: { teamId: team.id },
    });
  }

  for (const project of data.projects) {
    items.push({
      id: `project-${project.id}`,
      label: project.name,
      description: project.teamName,
      group: "Projects",
      icon: "project",
      kind: "navigate",
      to: "/teams/$teamId/projects/$projectId/$section",
      params: { teamId: project.teamId, projectId: project.id, section: "overview" },
    });
  }

  for (const member of data.members) {
    items.push({
      id: `member-${member.id}`,
      label: member.name ?? member.email,
      description: `${member.teamName} · ${member.role}`,
      group: "Members",
      icon: "members",
      kind: "navigate",
      to: "/teams/$teamId/members",
      params: { teamId: member.teamId },
    });
  }

  for (const conversation of data.conversations) {
    items.push({
      id: `conversation-${conversation.id}`,
      label: conversation.subject,
      description: `${conversation.projectName} · ${conversation.senderName ?? conversation.senderEmail}`,
      group: "Conversations",
      icon: "conversations",
      kind: "navigate",
      to: "/teams/$teamId/projects/$projectId/$section",
      params: {
        teamId: conversation.teamId,
        projectId: conversation.projectId,
        section: "conversations",
      },
    });
  }

  for (const event of data.statusEvents) {
    items.push({
      id: `status-${event.id}`,
      label: event.message,
      description: `${event.projectName} · ${event.operation}`,
      group: "Status events",
      icon: "status",
      kind: "navigate",
      to: "/teams/$teamId/projects/$projectId/$section",
      params: {
        teamId: event.teamId,
        projectId: event.projectId,
        section: "status",
      },
    });
  }

  return items;
}

export interface SearchResultGroup {
  label: string;
  items: GlobalSearchResultItem[];
}

const CORE_GROUP_ORDER = [
  "Navigation",
  "Project",
  "Help",
  "Teams",
  "Projects",
  "Members",
  "Conversations",
  "Status events",
] as const;

function buildGroupOrder(): string[] {
  const extensionGroups = extensionGlobalSearchGroupOrder();
  const helpIndex = CORE_GROUP_ORDER.indexOf("Help");
  return [
    ...CORE_GROUP_ORDER.slice(0, helpIndex + 1),
    ...extensionGroups,
    ...CORE_GROUP_ORDER.slice(helpIndex + 1),
  ];
}

export function groupSearchResults(items: GlobalSearchResultItem[]): SearchResultGroup[] {
  const byGroup = new Map<string, GlobalSearchResultItem[]>();

  for (const item of items) {
    const list = byGroup.get(item.group) ?? [];
    list.push(item);
    byGroup.set(item.group, list);
  }

  const groupOrder = buildGroupOrder();
  const orderedLabels = [
    ...groupOrder.filter((label) => byGroup.has(label)),
    ...[...byGroup.keys()].filter((label) => !groupOrder.includes(label)),
  ];

  return orderedLabels.map((label) => ({
    label,
    items: byGroup.get(label) ?? [],
  }));
}
