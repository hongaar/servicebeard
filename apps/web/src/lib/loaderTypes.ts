import type { TeamEntitlementUsage, TeamListingMeta } from "@servicebeard/shared/entitlements";
import type { Project, ProjectSyncError, Rule, Thread } from "./api";
import type { ProjectSection } from "./navigation";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
};

export type TeamSummary = {
  id: string;
  name: string;
  slug: string;
  role: string;
  meta?: TeamListingMeta;
};

export type ProjectsLoaderData = {
  user: AppUser;
  projects: Project[];
  entitlements: TeamEntitlementUsage | null;
  teamName: string;
};

export type ProjectDetailLoaderData = {
  user: AppUser;
  project: Project & { rules: Rule[] };
  entitlements: TeamEntitlementUsage | null;
  threads: Thread[];
  syncErrors: ProjectSyncError[];
  teamName: string;
  section: ProjectSection;
};
