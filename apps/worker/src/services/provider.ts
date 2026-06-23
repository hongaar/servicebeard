import type { projects } from "@serviceboard/db";
import { decrypt } from "@serviceboard/db";
import { createProvider, toProviderConfig } from "@serviceboard/providers";

type ProjectRow = typeof projects.$inferSelect;

export function projectProviderConfig(
  project: ProjectRow,
  extras?: { webhookUrl?: string; webhookSecret?: string },
) {
  return toProviderConfig({
    baseUrl: project.providerBaseUrl,
    projectId: project.providerProjectId,
    token: decrypt(project.providerTokenEncrypted),
    tlsInsecure: project.providerTlsInsecure,
    caCert: project.providerCaCertEncrypted
      ? decrypt(project.providerCaCertEncrypted)
      : null,
    webhookUrl: extras?.webhookUrl,
    webhookSecret: extras?.webhookSecret,
  });
}

export function createProjectProvider(
  project: ProjectRow,
  extras?: { webhookUrl?: string; webhookSecret?: string },
) {
  return createProvider(project.provider, projectProviderConfig(project, extras));
}
