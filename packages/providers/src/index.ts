export * from "./config";
export * from "./errors";
export * from "./github";
export * from "./github-app";
export * from "./gitlab";
export * from "./http";
export * from "./linear";
export * from "./log";
export * from "./types";
export * from "./upload";

import { GitHubProvider } from "./github";
import { GitLabProvider } from "./gitlab";
import { LinearProvider } from "./linear";
import type { IssueProvider, ProviderConfig } from "./types";

export function createProvider(
  type: string,
  config: ProviderConfig,
): IssueProvider {
  switch (type) {
    case "gitlab":
      return new GitLabProvider(config);
    case "github":
      return new GitHubProvider(config);
    case "linear":
      return new LinearProvider(config);
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}
