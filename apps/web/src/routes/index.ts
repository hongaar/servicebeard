import { createRoute, redirect } from "@tanstack/react-router";
import { api, ApiError } from "../lib/api";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { ProjectDetailPage } from "../pages/ProjectDetailPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { TeamPage } from "../pages/TeamPage";
import { rootRoute } from "./root.tsx";

async function requireUser() {
  const { user } = await api.getMe();
  if (!user) throw redirect({ to: "/login" });
  return user;
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
  loader: async () => {
    const user = await requireUser();
    const { teams } = await api.getTeams();
    return { user, teams };
  },
});

export const teamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId",
  component: TeamPage,
  loader: async ({ params }) => {
    const user = await requireUser();
    const team = await api.getTeam(params.teamId);
    return { user, team };
  },
});

export const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId/projects",
  component: ProjectsPage,
  loader: async ({ params }) => {
    const user = await requireUser();
    const { projects } = await api.getProjects(params.teamId);
    return { user, projects };
  },
});

export const projectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId/projects/$projectId",
  component: ProjectDetailPage,
  loader: async ({ params }) => {
    const user = await requireUser();
    try {
      const project = await api.getProject(params.teamId, params.projectId);
      const { threads } = await api.getThreads(params.teamId, params.projectId);
      return { user, project, threads };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw redirect({
          to: "/teams/$teamId/projects",
          params: { teamId: params.teamId },
        });
      }
      throw err;
    }
  },
});
