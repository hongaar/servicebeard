import { describe, expect, test } from "bun:test";

describe("entitlements", () => {
  test("default provider allows unlimited projects and team access", async () => {
    const { getEntitlements } = await import("./entitlements");

    await expect(
      getEntitlements().assertCanCreateProject("team-1", 999),
    ).resolves.toBeUndefined();
    await expect(
      getEntitlements().assertTeamAccess("team-1", {
        path: "/api/teams/team-1/projects",
      }),
    ).resolves.toBeUndefined();
  });
});
