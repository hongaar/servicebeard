import {
  isPublicRepositoryVisibility,
  lookupRepositoryVisibility,
  type RepositoryVisibility,
} from "@servicebeard/providers";
import { parseGithubRepository } from "@servicebeard/shared";

export interface RepositoryVisibilityQuery {
  provider: "github" | "gitlab";
  baseUrl: string;
  projectId: string;
  providerTlsInsecure?: boolean;
  providerCaCert?: string | null;
}

export async function getRepositoryVisibility(
  query: RepositoryVisibilityQuery,
): Promise<{ visibility: RepositoryVisibility }> {
  const baseUrl = query.baseUrl.trim();
  const projectId = query.projectId.trim();
  if (!baseUrl || !projectId) {
    return { visibility: "unknown" };
  }

  if (query.provider === "github") {
    try {
      parseGithubRepository(projectId);
    } catch {
      return { visibility: "unknown" };
    }
  }

  const visibility = await lookupRepositoryVisibility({
    provider: query.provider,
    baseUrl,
    projectId,
    tlsInsecure: query.providerTlsInsecure,
    caCert: query.providerCaCert,
  });

  return { visibility };
}

export { isPublicRepositoryVisibility };
