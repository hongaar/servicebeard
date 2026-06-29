import { describe, expect, test } from "bun:test";
import { bodyError, getSecurityContext, useSecurityContext } from "./helpers";

useSecurityContext();

describe("Tenant isolation — cross-team access must be denied", () => {
  test("Member of Team A cannot read Team B details by swapping teamId in URL", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.memberA.get(`/api/teams/${seed.teams.teamB.id}`);
    expect(response.status).toBe(403);
    expect(bodyError(response.body)).toBe("Forbidden");
  });

  test("Member of Team A cannot list Team B projects using Team B teamId", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.memberA.get(
      `/api/teams/${seed.teams.teamB.id}/projects`,
    );
    expect(response.status).toBe(403);
  });

  test("Member of Team A cannot read Team B project by using Team B teamId and projectId", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.memberA.get(
      `/api/teams/${seed.teams.teamB.id}/projects/${seed.projects.projectB.id}`,
    );
    expect(response.status).toBe(403);
  });

  test("Member of Team A cannot read Team B project by using Team A teamId with Team B projectId", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.memberA.get(
      `/api/teams/${seed.teams.teamA.id}/projects/${seed.projects.projectB.id}`,
    );
    expect(response.status).toBe(404);
    expect(bodyError(response.body)).toBe("Not found");
  });

  test("Member of Team A cannot read Team B thread by substituting Team B threadId into Team A project", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.memberA.get(
      `/api/teams/${seed.teams.teamA.id}/projects/${seed.projects.projectA.id}/threads/${seed.threads.threadB.id}`,
    );
    expect(response.status).toBe(404);
  });

  test("Outsider with no team membership cannot read any team resources", async () => {
    const { seed, client } = await getSecurityContext();
    const team = await client.outsider.get(`/api/teams/${seed.teams.teamA.id}`);
    expect(team.status).toBe(403);
    const projects = await client.outsider.get(
      `/api/teams/${seed.teams.teamA.id}/projects`,
    );
    expect(projects.status).toBe(403);
  });

  test("Team A admin must NOT delete Team B rule via Team A teamId (IDOR canary)", async () => {
    const { seed, client } = await getSecurityContext();
    const deleteResponse = await client.adminA.delete(
      `/api/teams/${seed.teams.teamA.id}/projects/${seed.projects.projectB.id}/rules/${seed.rules.ruleB.id}`,
    );
    expect([403, 404]).toContain(deleteResponse.status);

    const rulesResponse = await client.ownerB.get(
      `/api/teams/${seed.teams.teamB.id}/projects/${seed.projects.projectB.id}/rules`,
    );
    expect(rulesResponse.status).toBe(200);
    const rulesBody = rulesResponse.body as { rules: Array<{ id: string }> };
    expect(rulesBody.rules.some((rule) => rule.id === seed.rules.ruleB.id)).toBe(true);
  });
});
