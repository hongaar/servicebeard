import { describe, expect, test } from "bun:test";
import { getSecurityContext, useSecurityContext } from "./helpers";

useSecurityContext();

describe("Unauthenticated endpoint exposure and search scoping", () => {
  test("Health endpoints are reachable without authentication", async () => {
    const { client } = await getSecurityContext();
    const health = await client.anonymous.get("/healthz");
    expect(health.status).toBe(200);
    const ready = await client.anonymous.get("/readyz");
    expect(ready.status).toBe(200);
  });

  test("Metrics endpoint is reachable without authentication", async () => {
    const { client } = await getSecurityContext();
    const response = await client.anonymous.get("/metrics");
    expect(response.status).toBe(200);
    expect(String(response.body)).toContain("#");
  });

  test("Auth config is public and lists enabled providers", async () => {
    const { client } = await getSecurityContext();
    const response = await client.anonymous.get("/api/auth/config");
    expect(response.status).toBe(200);
    const body = response.body as { providers: Array<{ type: string }> };
    expect(Array.isArray(body.providers)).toBe(true);
  });

  test("GitHub App config is public", async () => {
    const { client } = await getSecurityContext();
    const response = await client.anonymous.get("/api/github-app/config");
    expect(response.status).toBe(200);
  });

  test("Search requires authentication", async () => {
    const { client } = await getSecurityContext();
    const response = await client.anonymous.get("/api/search?q=E2E");
    expect(response.status).toBe(401);
  });

  test("Search results are scoped to the authenticated user's teams only", async () => {
    const { seed, client } = await getSecurityContext();
    const memberA = await client.memberA.get("/api/search?q=E2E");
    expect(memberA.status).toBe(200);
    const memberBody = memberA.body as {
      teams?: Array<{ id: string }>;
      projects?: Array<{ id: string; teamId?: string }>;
    };

    const teamIds = new Set((memberBody.teams ?? []).map((team) => team.id));
    if (teamIds.size > 0) {
      expect(teamIds.has(seed.teams.teamA.id)).toBe(true);
      expect(teamIds.has(seed.teams.teamB.id)).toBe(false);
    }

    const ownerB = await client.ownerB.get("/api/search?q=E2E");
    expect(ownerB.status).toBe(200);
    const ownerBBody = ownerB.body as {
      teams?: Array<{ id: string }>;
    };
    const ownerBTeamIds = new Set((ownerBBody.teams ?? []).map((team) => team.id));
    if (ownerBTeamIds.size > 0) {
      expect(ownerBTeamIds.has(seed.teams.teamB.id)).toBe(true);
      expect(ownerBTeamIds.has(seed.teams.teamA.id)).toBe(false);
    }
  });
});
