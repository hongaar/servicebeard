import type { projects } from "@serviceboard/db";
import { decrypt } from "@serviceboard/db";
import { createProvider, toProviderConfig } from "@serviceboard/providers";

type ProjectRow = typeof projects.$inferSelect;

export function projectProviderConfig(project: ProjectRow) {
  return toProviderConfig({
    baseUrl: project.providerBaseUrl,
    projectId: project.providerProjectId,
    token: decrypt(project.providerTokenEncrypted),
    tlsInsecure: project.providerTlsInsecure,
    caCert: project.providerCaCertEncrypted
      ? decrypt(project.providerCaCertEncrypted)
      : null,
  });
}

export function createProjectProvider(project: ProjectRow) {
  return createProvider(project.provider, projectProviderConfig(project));
}

export function projectMailCredentials(project: ProjectRow) {
  return {
    imapHost: project.imapHost,
    imapPort: project.imapPort,
    imapSecure: project.imapSecure,
    imapUser: project.imapUser,
    imapPassword: decrypt(project.imapPasswordEncrypted),
  };
}
