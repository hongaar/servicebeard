import type { AnyRoute } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { EntitlementRequiredError } from "../lib/api";

export interface CloudTeamNavItem {
  to: string;
  params?: Record<string, string>;
  label: string;
  icon: LucideIcon;
  /** When false, the nav item is hidden. Defaults to true. */
  visible?: boolean;
}

export const cloudRoutes: AnyRoute[] = [];

export function cloudTeamNavItems(_teamId: string): CloudTeamNavItem[] {
  return [];
}

export function handleApiError(_error: EntitlementRequiredError): void {
  // Cloud builds override @cloudExtensions to redirect users to billing.
}

export function CloudAppExtras(): null {
  return null;
}

export function isCloudTeamNavActive(
  pathname: string,
  teamId: string,
  item: CloudTeamNavItem,
): boolean {
  const resolvedPath = item.to.replace("$teamId", teamId);
  return pathname === resolvedPath;
}
