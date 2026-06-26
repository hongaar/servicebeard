import type { AnyRoute } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { EntitlementRequiredError } from "../lib/api";
import type { LimitReachedDialogProps } from "../lib/limitDialog";

export interface ExtensionTeamNavItem {
  to: string;
  params?: Record<string, string>;
  label: string;
  icon: LucideIcon;
  /** When false, the nav item is hidden. Defaults to true. */
  visible?: boolean;
}

export interface EntitlementRedirect {
  to: string;
  params?: Record<string, string>;
}

export const extensionRoutes: AnyRoute[] = [];

export const extensionPublicRoutes: AnyRoute[] = [];

export const ExtensionLanding: ComponentType | undefined = undefined;

export const ExtensionDocsPublicHeader: ComponentType | undefined = undefined;

export const LimitReachedDialog: ComponentType<LimitReachedDialogProps> | undefined = undefined;

export type { LimitReachedDialogProps, LimitResource } from "../lib/limitDialog";

export function extensionTeamNavItems(_teamId: string): ExtensionTeamNavItem[] {
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

export function isExtensionTeamNavActive(
  pathname: string,
  teamId: string,
  item: ExtensionTeamNavItem,
): boolean {
  const resolvedPath = item.to.replace("$teamId", teamId);
  return pathname === resolvedPath;
}
