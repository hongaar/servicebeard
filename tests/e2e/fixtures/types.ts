export type SeedUserKey =
  "ownerA" | "adminA" | "memberA" | "ownerB" | "outsider" | "platformAdmin";

export interface SeedUserRef {
  id: string;
  email: string;
  name: string;
}

export interface SeedTeamRef {
  id: string;
  slug: string;
  name: string;
}

export interface SeedProjectRef {
  id: string;
  slug: string;
  name: string;
  webhookSecret: string;
}

export interface SeedRuleRef {
  id: string;
  name: string;
}

export interface SeedThreadRef {
  id: string;
  subject: string;
  externalIssueId: string;
}

export interface SeedData {
  users: Record<SeedUserKey, SeedUserRef>;
  teams: {
    teamA: SeedTeamRef;
    teamB: SeedTeamRef;
  };
  projects: {
    projectA: SeedProjectRef;
    projectB: SeedProjectRef;
  };
  rules: {
    ruleA: SeedRuleRef;
    ruleB: SeedRuleRef;
  };
  threads: {
    threadA: SeedThreadRef;
    threadB: SeedThreadRef;
  };
  password: string;
}
