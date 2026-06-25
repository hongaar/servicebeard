import type { ProviderConfig } from "./types";

export function toProviderConfig(input: {
  baseUrl: string;
  projectId: string;
  token: string;
  githubInstallationId?: string | null;
  tlsInsecure?: boolean;
  caCert?: string | null;
  webhookUrl?: string;
  webhookSecret?: string;
}): ProviderConfig {
  return {
    baseUrl: input.baseUrl,
    projectId: input.projectId,
    token: input.token,
    githubInstallationId: input.githubInstallationId ?? null,
    tlsInsecure: input.tlsInsecure ?? false,
    caCert: input.caCert ?? null,
    webhookUrl: input.webhookUrl,
    webhookSecret: input.webhookSecret,
  };
}
