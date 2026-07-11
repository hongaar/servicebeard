import type { BlockedMailPortsConfig } from "@servicebeard/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const EMPTY_CONFIG: BlockedMailPortsConfig = {
  blockedImapPorts: [],
  blockedSmtpPorts: [],
};

export function useInstanceConfig() {
  return useQuery({
    queryKey: ["instance-config"],
    queryFn: () => api.getInstanceConfig(),
    staleTime: 300_000,
    placeholderData: EMPTY_CONFIG,
  });
}
