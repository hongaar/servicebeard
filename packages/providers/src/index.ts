export * from "./config";
export * from "./errors";
export * from "./github";
export * from "./github-app";
export * from "./gitlab";
export * from "./http";
export * from "./log";
export * from "./types";

import { GitHubProvider } from "./github";
import { GitLabProvider } from "./gitlab";
import type { IssueProvider, ProviderConfig } from "./types";

export function createProvider(type: string, config: ProviderConfig): IssueProvider {
  switch (type) {
    case "gitlab":
      return new GitLabProvider(config);
    case "github":
      return new GitHubProvider(config);
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}
