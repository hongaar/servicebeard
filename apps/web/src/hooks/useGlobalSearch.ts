import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useDebouncedValue } from "./useDebouncedValue";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function useGlobalSearchQuery(query: string) {
  const trimmed = query.trim();
  const debouncedQuery = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const enabled = debouncedQuery.length >= MIN_QUERY_LENGTH;

  return useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: () => api.globalSearch(debouncedQuery),
    enabled,
    staleTime: 60_000,
    gcTime: 300_000,
    placeholderData: (previous) => previous,
  });
}

export { MIN_QUERY_LENGTH, SEARCH_DEBOUNCE_MS };
