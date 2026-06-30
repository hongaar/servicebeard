import { ExtensionLanding } from "@extensions";
import { createRoute, redirect } from "@tanstack/react-router";
import { api, ApiError } from "../lib/api";
import { documentTitle, routeHead } from "../lib/documentTitle";
import {
  DEFAULT_PROJECT_SECTION,
  isProjectSection,
  PROJECT_SECTION_LABELS,
  type ProjectSection,
} from "../lib/navigation";
import { AcceptInvitePage } from "../pages/AcceptInvitePage";
import { AccountPage } from "../pages/AccountPage";
import { AdminAuditLogPage } from "../pages/AdminAuditLogPage";
import { AdminStatusPage } from "../pages/AdminStatusPage";
import { DocsGitHubPage } from "../pages/docs/DocsGitHubPage";
import { DocsGitLabPage } from "../pages/docs/DocsGitLabPage";
import { DocsIndexPage } from "../pages/docs/DocsIndexPage";
import { DocsIssueProvidersPage } from "../pages/docs/DocsIssueProvidersPage";
import { DocsLinearPage } from "../pages/docs/DocsLinearPage";
import { DocsMailboxPage } from "../pages/docs/DocsMailboxPage";
import { DocsSelfHostPage } from "../pages/docs/DocsSelfHostPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { GithubAppInstallCompletePage } from "../pages/GithubAppInstallCompletePage";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { ProjectDetailPage } from "../pages/ProjectDetailPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { SignupPage } from "../pages/SignupPage";
import { TeamPage } from "../pages/TeamPage";
import { TeamSettingsPage } from "../pages/TeamSettingsPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";
import { rootRoute } from "./root.tsx";

async function requireUser() {
  const { user } = await api.getMe();
  if (!user) throw redirect({ to: "/login" });
  return user;
}

async function loadTeamContext(teamId: string) {
  const user = await requireUser();
  const [team, { teams: memberships }] = await Promise.all([
    api.getTeam(teamId),
    api.getTeams(),
  ]);
  const membership = memberships.find((t) => t.id === teamId);
  return { user, team, role: membership?.role ?? "member" };
}

async function loadProjectContext(teamId: string, projectId: string) {
  const user = await requireUser();
  try {
    const [team, projectData, { threads }, { events: statusEvents }] =
      await Promise.all([
        api.getTeam(teamId),
        api.getProject(teamId, projectId),
        api.getThreads(teamId, projectId),
        api.getStatusEvents(teamId, projectId),
      ]);
    const { entitlements, rules, ...project } = projectData;
    return {
      user,
      project: { ...project, rules },
      entitlements,
      threads,
      statusEvents,
      teamName: team.name,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw redirect({
        to: "/teams/$teamId/projects",
        params: { teamId },
      });
    }
    throw err;
  }
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
  head: routeHead("Sign in"),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
});

export const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: SignupPage,
  head: routeHead("Sign up"),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
});

export const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
  head: routeHead("Reset password"),
});

export const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  component: ResetPasswordPage,
  head: routeHead("Choose a new password"),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

export const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verify-email",
  component: VerifyEmailPage,
  head: routeHead("Confirm your email"),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

export const acceptInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invites/$token",
  component: AcceptInvitePage,
  head: routeHead("Team invite"),
});

export const docsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
  component: DocsIndexPage,
  head: routeHead("Documentation"),
});

export const docsMailboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/mailbox",
  component: DocsMailboxPage,
  head: routeHead("Mailbox configuration"),
});

export const docsIssueProvidersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/issue-providers",
  component: DocsIssueProvidersPage,
  head: routeHead("Issue providers"),
});

export const docsGitHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/issue-providers/github",
  component: DocsGitHubPage,
  head: routeHead("GitHub authentication"),
});

export const docsGitLabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/issue-providers/gitlab",
  component: DocsGitLabPage,
  head: routeHead("GitLab access token"),
});

export const docsLinearRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/issue-providers/linear",
  component: DocsLinearPage,
  head: routeHead("Linear API key"),
});

export const docsSelfHostRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/self-host",
  component: DocsSelfHostPage,
  head: routeHead("Self-hosting"),
});

export const githubAppInstallCompleteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/github-app/install-complete",
  component: GithubAppInstallCompletePage,
  head: routeHead("GitHub App"),
});

export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
  head: ({ loaderData }) => ({
    meta: [
      {
        title:
          loaderData?.landing === false
            ? documentTitle("Teams")
            : documentTitle(),
      },
    ],
  }),
  loader: async () => {
    const { user } = await api.getMe();
    if (!user) {
      if (ExtensionLanding) {
        return { landing: true as const };
      }
      throw redirect({ to: "/login" });
    }
    const [{ teams }, { invites: pendingInvites }] = await Promise.all([
      api.getTeams(),
      api.getPendingInvites(),
    ]);
    return { landing: false as const, user, teams, pendingInvites };
  },
});

export const adminStatusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/status",
  component: AdminStatusPage,
  head: routeHead("System status"),
  loader: async () => {
    const { user } = await api.getMe();
    if (!user) throw redirect({ to: "/login" });
    if (!user.isAdmin) throw redirect({ to: "/" });
    return { user };
  },
});

export const adminAuditLogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/audit-log",
  component: AdminAuditLogPage,
  head: routeHead("Audit log"),
  loader: async () => {
    const { user } = await api.getMe();
    if (!user) throw redirect({ to: "/login" });
    if (!user.isAdmin) throw redirect({ to: "/" });
    return { user };
  },
});

export const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: AccountPage,
  head: routeHead("Account"),
  loader: async () => {
    const user = await requireUser();
    return { user };
  },
});

export const teamRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId",
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/teams/$teamId/projects",
      params: { teamId: params.teamId },
    });
  },
});

export const teamMembersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId/members",
  component: TeamPage,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: documentTitle(
          "Members",
          (loaderData as { team: { name: string } } | undefined)?.team.name,
        ),
      },
    ],
  }),
  loader: async ({ params }) => {
    const { user, team, role } = await loadTeamContext(params.teamId);
    return { user, team, role };
  },
});

export const teamSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId/settings",
  component: TeamSettingsPage,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: documentTitle(
          "Team settings",
          (loaderData as { team: { name: string } } | undefined)?.team.name,
        ),
      },
    ],
  }),
  loader: async ({ params }) => {
    const { user, team, role } = await loadTeamContext(params.teamId);
    return { user, team, role };
  },
});

export const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId/projects",
  component: ProjectsPage,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: documentTitle(
          "Projects",
          (loaderData as { teamName: string } | undefined)?.teamName,
        ),
      },
    ],
  }),
  loader: async ({ params }) => {
    const user = await requireUser();
    const [team, { projects, entitlements }] = await Promise.all([
      api.getTeam(params.teamId),
      api.getProjects(params.teamId),
    ]);
    return { user, projects, entitlements, teamName: team.name };
  },
});

export const projectRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId/projects/$projectId",
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/teams/$teamId/projects/$projectId/$section",
      params: {
        teamId: params.teamId,
        projectId: params.projectId,
        section: DEFAULT_PROJECT_SECTION,
      },
    });
  },
});

export const projectSectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId/projects/$projectId/$section",
  component: ProjectDetailPage,
  head: ({ loaderData }) => {
    const data = loaderData as
      | {
          section: ProjectSection;
          project: { name: string };
        }
      | undefined;
    return {
      meta: [
        {
          title: data
            ? documentTitle(
                PROJECT_SECTION_LABELS[data.section],
                data.project.name,
              )
            : documentTitle(),
        },
      ],
    };
  },
  beforeLoad: ({ params }) => {
    if (!isProjectSection(params.section)) {
      throw redirect({
        to: "/teams/$teamId/projects/$projectId/$section",
        params: {
          teamId: params.teamId,
          projectId: params.projectId,
          section: DEFAULT_PROJECT_SECTION,
        },
      });
    }
  },
  loader: async ({ params }) => {
    const data = await loadProjectContext(params.teamId, params.projectId);
    return {
      ...data,
      section: params.section as ProjectSection,
    };
  },
});
