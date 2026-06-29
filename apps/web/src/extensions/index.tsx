import type { AnyRoute } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { EntitlementRequiredError } from "../lib/api";
import type { GlobalSearchAction, GlobalSearchContext } from "../lib/globalSearch";
import type { LimitReachedDialogProps } from "../lib/limitDialog";
import type { NavIconKey } from "../lib/navigation";

export interface ExtensionGlobalSearchGroup {
  label: string;
  actions: Omit<GlobalSearchAction, "group">[];
}

export interface ExtensionTeamNavItem {
  to: string;
  params?: Record<string, string>;
  label: string;
  icon: LucideIcon;
  /** Icon key for global search results (sidebar uses `icon`). */
  searchIcon?: NavIconKey;
  /** When false, the nav item is hidden. Defaults to true. */
  visible?: boolean;
}

export interface EntitlementRedirect {
  to: string;
  params?: Record<string, string>;
}

export interface ExtensionAppFooterLink {
  label: string;
  to: string;
}

export const extensionRoutes: AnyRoute[] = [];

export const extensionPublicRoutes: AnyRoute[] = [];

export const ExtensionLanding: ComponentType | undefined = undefined;

export const ExtensionDocsPublicHeader: ComponentType | undefined = undefined;

export const LimitReachedDialog: ComponentType<LimitReachedDialogProps> | undefined = undefined;

export type { LimitReachedDialogProps, LimitResource } from "../lib/limitDialog";

export {
    extensionCreateTeamDialogHint,
    extensionDashboardTeamsDescription,
    extensionProjectsEmptyAction,
    extensionProjectsEmptyHint,
    extensionProjectsSectionDescription,
    extensionTeamCardBadge
} from "./ui";
export type {
    ExtensionCreateTeamContext,
    ExtensionProjectsPageContext
} from "./ui";

export function extensionTeamNavItems(_teamId: string): ExtensionTeamNavItem[] {
  return [];
}

/** Breadcrumb icon for extension team pages (e.g. billing). */
export function extensionTeamPageIcon(
  _pathname: string,
  _teamId: string,
): LucideIcon | undefined {
  return undefined;
}

export function extensionGlobalSearchGroups(
  _context: GlobalSearchContext,
): ExtensionGlobalSearchGroup[] {
  return [];
}

/** Extension search group labels, inserted after Help in result ordering. */
export function extensionGlobalSearchGroupOrder(): string[] {
  return [];
}

export function handleApiError(
  _error: EntitlementRequiredError,
  _context?: { requestPath?: string },
): EntitlementRedirect | undefined {
  return undefined;
}

export function extensionAppExtras(): null {
  return null;
}

export function extensionAppFooterLinks(): ExtensionAppFooterLink[] {
  return [];
}

export interface ExtensionAdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export function extensionAdminNavItems(): ExtensionAdminNavItem[] {
  return [];
}

export function isExtensionTeamNavActive(
  pathname: string,
  teamId: string,
  item: ExtensionTeamNavItem,
): boolean {
  const resolvedPath = item.to.replace("$teamId", teamId);
  return pathname === resolvedPath;
}
