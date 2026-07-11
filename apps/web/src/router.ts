import { extensionPublicRoutes, extensionRoutes } from "@extensions";
import { createRouter } from "@tanstack/react-router";
import { RouteError } from "./components/RouteError";
import {
  acceptInviteRoute,
  accountRoute,
  adminAuditLogRoute,
  adminHealthRoute,
  adminJobRunsRoute,
  adminOverviewRoute,
  adminProjectStatusRoute,
  adminStatusRedirectRoute,
  dashboardRoute,
  docsGitHubRoute,
  docsGitLabRoute,
  docsIndexRoute,
  docsIssueProvidersRoute,
  docsLinearRoute,
  docsMailboxRoute,
  docsSelfHostRoute,
  forgotPasswordRoute,
  githubAppInstallCompleteRoute,
  loginRoute,
  projectRedirectRoute,
  projectSectionRoute,
  projectsRoute,
  resetPasswordRoute,
  signupRoute,
  teamMembersRoute,
  teamRedirectRoute,
  teamSettingsRoute,
  verifyEmailRoute,
  welcomeRoute,
} from "./routes/index";
import { rootRoute } from "./routes/root.tsx";

const routeTree = rootRoute.addChildren([
  loginRoute,
  signupRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  verifyEmailRoute,
  acceptInviteRoute,
  ...extensionPublicRoutes,
  docsIndexRoute,
  docsMailboxRoute,
  docsIssueProvidersRoute,
  docsGitHubRoute,
  docsGitLabRoute,
  docsLinearRoute,
  docsSelfHostRoute,
  githubAppInstallCompleteRoute,
  welcomeRoute,
  dashboardRoute,
  adminOverviewRoute,
  adminHealthRoute,
  adminStatusRedirectRoute,
  adminProjectStatusRoute,
  adminAuditLogRoute,
  adminJobRunsRoute,
  accountRoute,
  teamRedirectRoute,
  teamMembersRoute,
  teamSettingsRoute,
  ...extensionRoutes,
  projectsRoute,
  projectRedirectRoute,
  projectSectionRoute,
]);

export const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteError,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
