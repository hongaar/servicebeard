import { useEffect } from "react";
import { useMe } from "../hooks/useAppQueries";
import { setBugsinkUser } from "../lib/bugsink";

export function BugsinkUserSync() {
  const { data } = useMe({ retry: false });

  useEffect(() => {
    setBugsinkUser(data?.user ?? null);
  }, [data?.user]);

  return null;
}
