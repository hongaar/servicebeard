import { extensionPublicRoutes, extensionRoutes } from "@extensions";
import { createRouter } from "@tanstack/react-router";
import {
    dashboardRoute,
    docsGitHubRoute,
    docsGitLabRoute,
    docsIndexRoute,
    docsIssueProvidersRoute,
    docsMailboxRoute,
    githubAppInstallCompleteRoute,
    loginRoute,
    projectRedirectRoute,
    projectSectionRoute,
    projectsRoute,
    teamMembersRoute,
    teamRedirectRoute,
    teamSettingsRoute,
} from "./routes/index";
import { rootRoute } from "./routes/root.tsx";

const routeTree = rootRoute.addChildren([
  loginRoute,
  ...extensionPublicRoutes,
  docsIndexRoute,
  docsMailboxRoute,
  docsIssueProvidersRoute,
  docsGitHubRoute,
  docsGitLabRoute,
  githubAppInstallCompleteRoute,
  dashboardRoute,
  teamRedirectRoute,
  teamMembersRoute,
  teamSettingsRoute,
  ...extensionRoutes,
  projectsRoute,
  projectRedirectRoute,
  projectSectionRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
