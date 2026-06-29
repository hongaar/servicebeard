import type { LucideIcon } from "lucide-react";
import {
    Activity,
    Building2,
    CreditCard,
    FileText,
    Home,
    LayoutDashboard,
    Mailbox,
    MessagesSquare,
    Server,
    Settings,
    SlidersHorizontal,
    Users,
} from "lucide-react";

export const PROJECT_SECTIONS = [
  "overview",
  "rules",
  "conversations",
  "status",
  "templates",
  "settings",
] as const;

export type ProjectSection = (typeof PROJECT_SECTIONS)[number];

export const PROJECT_SECTION_LABELS: Record<ProjectSection, string> = {
  overview: "Overview",
  rules: "Rules",
  conversations: "Conversations",
  status: "Status",
  templates: "Templates",
  settings: "Settings",
};

export function isProjectSection(value: string): value is ProjectSection {
  return (PROJECT_SECTIONS as readonly string[]).includes(value);
}

export const DEFAULT_PROJECT_SECTION: ProjectSection = "overview";

/** Shared icon keys for sidebar nav and breadcrumbs. */
export const NAV_ICONS = {
  home: Home,
  teams: Building2,
  /** Team entity (name in breadcrumb) — distinct from members page. */
  team: Building2,
  projects: Mailbox,
  project: Mailbox,
  members: Users,
  billing: CreditCard,
  teamSettings: Settings,
  adminStatus: Server,
  overview: LayoutDashboard,
  rules: SlidersHorizontal,
  conversations: MessagesSquare,
  status: Activity,
  templates: FileText,
  settings: Settings,
} as const satisfies Record<string, LucideIcon>;

export type NavIconKey = keyof typeof NAV_ICONS;

export function teamPageIcon(pathname: string, teamId: string): NavIconKey | undefined {
  if (pathname === `/teams/${teamId}/projects`) return "projects";
  if (pathname === `/teams/${teamId}/members`) return "members";
  if (pathname === `/teams/${teamId}/settings`) return "teamSettings";
  return undefined;
}
