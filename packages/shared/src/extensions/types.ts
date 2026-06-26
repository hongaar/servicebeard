export interface TeamEntitlementUsage {
  projects: { used: number; limit: number | null };
  rules: { used: number; limit: number | null };
}

export interface EntitlementsProvider {
  assertCanCreateProject(teamId: string, currentCount: number): Promise<void>;
  assertTeamAccess(teamId: string, ctx: { path: string }): Promise<void>;
  assertCanCreateRule?(teamId: string, currentRuleCount: number): Promise<void>;
  assertCanCreateConversation?(teamId: string, conversationsThisMonth: number): Promise<void>;
  getBillingPeriod?(teamId: string): Promise<{ start: Date; end: Date }>;
  getTeamEntitlementUsage?(teamId: string): Promise<TeamEntitlementUsage>;
  getImapPollIntervalSeconds?(teamId: string): number | Promise<number> | undefined;
}

export interface ExtensionApp {
  route(path: string, handler: unknown): void;
}

export interface ExtensionContext {
  app: ExtensionApp;
  setEntitlementsProvider: (provider: EntitlementsProvider) => void;
}

export interface ExtensionModule {
  register(ctx: ExtensionContext): void | Promise<void>;
}

export interface WorkerExtensionContext {
  boss: {
    createQueue(name: string, options?: { name?: string; policy?: string }): Promise<void>;
    schedule(
      name: string,
      cron: string,
      data: Record<string, unknown>,
      options?: { tz?: string },
    ): Promise<void>;
    work<T>(
      name: string,
      options: { batchSize: number },
      handler: (jobs: Array<{ data: T }>) => Promise<void>,
    ): void;
  };
}

export interface WorkerExtensionModule {
  register(ctx: WorkerExtensionContext): void | Promise<void>;
}
