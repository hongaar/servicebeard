export interface TeamAccessContext {
  path: string;
}

export interface EntitlementsProvider {
  assertCanCreateProject(teamId: string, currentCount: number): Promise<void>;
  assertTeamAccess(teamId: string, ctx: TeamAccessContext): Promise<void>;
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
