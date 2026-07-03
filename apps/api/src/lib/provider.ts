import type { projects } from "@servicebeard/db";
import { decrypt } from "@servicebeard/db";
import {
  createProvider,
  LinearProvider,
  toProviderConfig,
} from "@servicebeard/providers";
import { formatProviderProjectLabel } from "@servicebeard/shared";

type ProjectRow = typeof projects.$inferSelect;

export function projectProviderConfig(project: ProjectRow) {
  return toProviderConfig({
    baseUrl: project.providerBaseUrl,
    projectId: project.providerProjectId,
    token: decrypt(project.providerTokenEncrypted),
    githubInstallationId: project.providerGithubInstallationId,
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

export async function enrichProviderProjectLabel<
  T extends Record<string, unknown>,
>(project: ProjectRow, payload: T) {
  const fallback = formatProviderProjectLabel(
    project.provider,
    project.providerProjectId,
  );

  const needsLinearEnrichment =
    fallback.kind === "team" ||
    (fallback.kind === "project" && !fallback.workspace);

  if (
    project.provider !== "linear" ||
    !project.providerTokenEncrypted ||
    !needsLinearEnrichment
  ) {
    return {
      ...payload,
      providerProjectLabel: fallback.label,
      providerProjectKind: fallback.kind,
    };
  }

  try {
    const provider = createProjectProvider(project);
    if (provider instanceof LinearProvider) {
      const resolved = await provider.resolveProjectDisplayLabel();
      return {
        ...payload,
        providerProjectLabel: resolved.label,
        providerProjectKind: resolved.kind,
      };
    }
  } catch {
    // Use static label when Linear is unreachable or misconfigured.
  }

  return {
    ...payload,
    providerProjectLabel: fallback.label,
    providerProjectKind: fallback.kind,
  };
}
