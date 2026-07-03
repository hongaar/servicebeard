export interface TeamAccessContext {
  path: string;
}

export interface TeamEntitlementUsage {
  planId: string;
  subscriptionRequired?: boolean;
  projects: { used: number; limit: number | null };
  rules: { used: number; limit: number | null };
}

export interface TeamListingMeta {
  subscriptionRequired: boolean;
}

export interface EntitlementsProvider {
  assertCanCreateProject(teamId: string, currentCount: number): Promise<void>;
  assertCanActivateProject?(
    teamId: string,
    currentActiveCount: number,
  ): Promise<void>;
  assertTeamAccess(teamId: string, ctx: TeamAccessContext): Promise<void>;
  assertCanCreateRule?(teamId: string, currentRuleCount: number): Promise<void>;
  assertCanEnableRule?(
    teamId: string,
    currentEnabledCount: number,
  ): Promise<void>;
  assertCanCreateConversation?(
    teamId: string,
    conversationsThisMonth: number,
  ): Promise<void>;
  getBillingPeriod?(teamId: string): Promise<{ start: Date; end: Date }>;
  getTeamEntitlementUsage?(teamId: string): Promise<TeamEntitlementUsage>;
  getTeamListingMeta?(teamId: string): Promise<TeamListingMeta>;
  isTeamOperational?(teamId: string): Promise<boolean>;
  getImapPollIntervalSeconds?(
    teamId: string,
  ): number | Promise<number | undefined> | undefined;
}

const unlimitedEntitlements: EntitlementsProvider = {
  async assertCanCreateProject() {},
  async assertTeamAccess() {},
};

let provider: EntitlementsProvider = unlimitedEntitlements;

export function setEntitlementsProvider(next: EntitlementsProvider): void {
  provider = next;
}

export function getEntitlements(): EntitlementsProvider {
  return provider;
}

export function resetEntitlementsProvider(): void {
  provider = unlimitedEntitlements;
}
