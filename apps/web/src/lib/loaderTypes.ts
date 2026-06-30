import type {
  TeamEntitlementUsage,
  TeamListingMeta,
} from "@servicebeard/shared/entitlements";
import type { Project, ProjectStatusEvent, Rule, Thread } from "./api";
import type { ProjectSection } from "./navigation";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
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
  statusEvents: ProjectStatusEvent[];
  teamName: string;
  section: ProjectSection;
};
