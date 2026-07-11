import { QueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  teams: {
    all: ["teams"] as const,
    detail: (teamId: string) => ["team", teamId] as const,
    projects: (teamId: string) => ["projects", teamId] as const,
    pendingInvites: ["teams", "pending-invites"] as const,
  },
} as const;

export const appQueries = {
  me: () => ({
    queryKey: queryKeys.auth.me,
    queryFn: () => api.getMe(),
    staleTime: 60_000,
  }),
  teams: () => ({
    queryKey: queryKeys.teams.all,
    queryFn: () => api.getTeams(),
  }),
  team: (teamId: string) => ({
    queryKey: queryKeys.teams.detail(teamId),
    queryFn: () => api.getTeam(teamId),
  }),
  projects: (teamId: string) => ({
    queryKey: queryKeys.teams.projects(teamId),
    queryFn: () => api.getProjects(teamId),
  }),
  pendingInvites: () => ({
    queryKey: queryKeys.teams.pendingInvites,
    queryFn: () => api.getPendingInvites(),
  }),
};

type RefreshAppRoutesOptions = {
  teams?: boolean;
  projectsTeamId?: string;
  pendingInvites?: boolean;
  teamId?: string;
};

export function prependCreatedTeamToCache(team: {
  id: string;
  name: string;
  slug: string;
}) {
  queryClient.setQueryData<{
    teams: Array<{ id: string; name: string; slug: string; role: string }>;
  }>(queryKeys.teams.all, (existing) => {
    if (existing?.teams.some((entry) => entry.id === team.id)) {
      return existing;
    }

    return {
      teams: [{ ...team, role: "owner" }, ...(existing?.teams ?? [])],
    };
  });
}

export async function refreshAppRoutes(
  router: { invalidate: () => Promise<void> },
  options: RefreshAppRoutesOptions = {},
) {
  const invalidations: Promise<unknown>[] = [];

  if (options.teams !== false) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all }),
    );
  }
  if (options.teamId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.detail(options.teamId),
      }),
    );
  }
  if (options.projectsTeamId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.projects(options.projectsTeamId),
      }),
    );
  }
  if (options.pendingInvites) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.pendingInvites,
      }),
    );
  }

  await Promise.all(invalidations);
  await router.invalidate();
}
