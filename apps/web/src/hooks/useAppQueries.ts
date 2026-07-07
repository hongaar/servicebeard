import { useQuery } from "@tanstack/react-query";
import { appQueries } from "../lib/queryClient";

export function useMe(options?: { retry?: boolean | number }) {
  return useQuery({
    ...appQueries.me(),
    retry: options?.retry,
  });
}

export function useTeams() {
  return useQuery(appQueries.teams());
}

export function useTeamProjects(teamId: string | undefined) {
  return useQuery({
    ...appQueries.projects(teamId!),
    enabled: !!teamId,
  });
}
