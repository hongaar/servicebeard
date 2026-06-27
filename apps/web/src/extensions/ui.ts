import type { TeamEntitlementUsage } from "@servicebeard/shared/entitlements";
import type { ReactNode } from "react";
import type { TeamSummary } from "../lib/loaderTypes";

export interface ExtensionCreateTeamContext {
  ownedTeamCount: number;
}

export interface ExtensionProjectsPageContext {
  teamId: string;
  projectsCount: number;
  entitlements: TeamEntitlementUsage | null;
}

/** Optional extra sentence under “Your teams” on the dashboard. */
export function extensionDashboardTeamsDescription(): string | undefined {
  return undefined;
}

/** Extra hint in the create-team dialog, appended after the default intro. */
export function extensionCreateTeamDialogHint(_ctx: ExtensionCreateTeamContext): string | null {
  return null;
}

/** Badge or label rendered beside the role on a team card. */
export function extensionTeamCardBadge(_team: TeamSummary): ReactNode {
  return null;
}

/** Overrides the projects list section description when non-null. */
export function extensionProjectsSectionDescription(
  _ctx: ExtensionProjectsPageContext,
): string | null {
  return null;
}

/** Overrides the empty-state hint on the projects page when non-null. */
export function extensionProjectsEmptyHint(_ctx: ExtensionProjectsPageContext): string | null {
  return null;
}

/** Overrides the empty-state primary action; null keeps the default create button. */
export function extensionProjectsEmptyAction(_ctx: ExtensionProjectsPageContext): ReactNode {
  return null;
}
