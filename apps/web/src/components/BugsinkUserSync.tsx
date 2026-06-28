import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../lib/api";
import { setBugsinkUser } from "../lib/bugsink";

export function BugsinkUserSync() {
  const { data } = useQuery({
    queryKey: ["bugsink", "me"],
    queryFn: () => api.getMe(),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    setBugsinkUser(data?.user ?? null);
  }, [data?.user]);

  return null;
}
