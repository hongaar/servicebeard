import { beforeAll } from "bun:test";
import { createApiClient } from "../e2e/fixtures/client";
import { loadSeedData } from "../e2e/fixtures/load-seed";
import { mintSession } from "../e2e/fixtures/session";
import type { SeedData } from "../e2e/fixtures/types";

export type SecurityContext = {
  seed: SeedData;
  sessions: Record<
    "ownerA" | "adminA" | "memberA" | "ownerB" | "outsider" | "platformAdmin",
    string
  >;
  client: Record<
    | "ownerA"
    | "adminA"
    | "memberA"
    | "ownerB"
    | "outsider"
    | "platformAdmin"
    | "anonymous",
    ReturnType<typeof createApiClient>
  >;
};

let sharedContext: SecurityContext | null = null;

export async function getSecurityContext(): Promise<SecurityContext> {
  if (sharedContext) return sharedContext;

  const seed = loadSeedData();
  const sessions = {
    ownerA: await mintSession(seed.users.ownerA.id),
    adminA: await mintSession(seed.users.adminA.id),
    memberA: await mintSession(seed.users.memberA.id),
    ownerB: await mintSession(seed.users.ownerB.id),
    outsider: await mintSession(seed.users.outsider.id),
    platformAdmin: await mintSession(seed.users.platformAdmin.id),
  };

  sharedContext = {
    seed,
    sessions,
    client: {
      ownerA: createApiClient(sessions.ownerA),
      adminA: createApiClient(sessions.adminA),
      memberA: createApiClient(sessions.memberA),
      ownerB: createApiClient(sessions.ownerB),
      outsider: createApiClient(sessions.outsider),
      platformAdmin: createApiClient(sessions.platformAdmin),
      anonymous: createApiClient(),
    },
  };

  return sharedContext;
}

export function useSecurityContext(): void {
  beforeAll(async () => {
    await getSecurityContext();
  });
}

export function bodyError(body: unknown): string | undefined {
  if (body && typeof body === "object" && "error" in body) {
    return String((body as { error: unknown }).error);
  }
  return undefined;
}
