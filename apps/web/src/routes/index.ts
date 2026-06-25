import { createRoute, redirect } from "@tanstack/react-router";
import { api, ApiError } from "../lib/api";
import {
    DEFAULT_PROJECT_SECTION,
    isProjectSection,
    type ProjectSection,
} from "../lib/navigation";
import { DocsGitHubPage } from "../pages/docs/DocsGitHubPage";
import { DocsGitLabPage } from "../pages/docs/DocsGitLabPage";
import { DocsIndexPage } from "../pages/docs/DocsIndexPage";
import { DocsIssueProvidersPage } from "../pages/docs/DocsIssueProvidersPage";
import { DocsMailboxPage } from "../pages/docs/DocsMailboxPage";
import { GithubAppInstallCompletePage } from "../pages/GithubAppInstallCompletePage";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { ProjectDetailPage } from "../pages/ProjectDetailPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { TeamPage } from "../pages/TeamPage";
import { TeamSettingsPage } from "../pages/TeamSettingsPage";
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
    const [team, project, { threads }, { errors: syncErrors }] = await Promise.all([
      api.getTeam(teamId),
      api.getProject(teamId, projectId),
      api.getThreads(teamId, projectId),
      api.getSyncErrors(teamId, projectId),
    ]);
    return { user, project, threads, syncErrors, teamName: team.name };
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
});

export const docsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
  component: DocsIndexPage,
});

export const docsMailboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/mailbox",
  component: DocsMailboxPage,
});

export const docsIssueProvidersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/issue-providers",
  component: DocsIssueProvidersPage,
});

export const docsGitHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/issue-providers/github",
  component: DocsGitHubPage,
});

export const docsGitLabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/issue-providers/gitlab",
  component: DocsGitLabPage,
});

export const githubAppInstallCompleteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/github-app/install-complete",
  component: GithubAppInstallCompletePage,
});

export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
  loader: async () => {
    const { user } = await api.getMe();
    if (!user) throw redirect({ to: "/login" });
    const { teams } = await api.getTeams();
    return { user, teams };
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
  loader: async ({ params }) => {
    const { user, team, role } = await loadTeamContext(params.teamId);
    return { user, team, role };
  },
});

export const teamSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId/settings",
  component: TeamSettingsPage,
  loader: async ({ params }) => {
    const { user, team, role } = await loadTeamContext(params.teamId);
    return { user, team, role };
  },
});

export const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId/projects",
  component: ProjectsPage,
  loader: async ({ params }) => {
    const user = await requireUser();
    const [team, { projects }] = await Promise.all([
      api.getTeam(params.teamId),
      api.getProjects(params.teamId),
    ]);
    return { user, projects, teamName: team.name };
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
