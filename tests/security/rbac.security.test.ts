import { describe, expect, test } from "bun:test";
import { bodyError, getSecurityContext, useSecurityContext } from "./helpers";

useSecurityContext();

describe("RBAC — role-based access control must enforce team roles", () => {
  test("Team member cannot create projects (admin-only)", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.memberA.post(
      `/api/teams/${seed.teams.teamA.id}/projects`,
      {
        name: "Forbidden Project",
        slug: "forbidden-project",
        provider: "gitlab",
        providerBaseUrl: "https://gitlab.example.com",
        providerProjectId: "999",
        providerToken: "token",
        imapHost: "localhost",
        imapPort: 3143,
        imapSecure: false,
        imapUser: "user",
        imapPassword: "pass",
        smtpHost: "localhost",
        smtpPort: 3025,
        smtpSecure: false,
        smtpUser: "user",
        smtpPassword: "pass",
        smtpFrom: "user@example.com",
      },
    );
    expect(response.status).toBe(403);
    expect(bodyError(response.body)).toBe("Forbidden");
  });

  test("Team member cannot update team settings (admin-only)", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.memberA.patch(
      `/api/teams/${seed.teams.teamA.id}`,
      {
        name: "Renamed by member",
      },
    );
    expect(response.status).toBe(403);
  });

  test("Team member cannot invite members (admin-only)", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.memberA.post(
      `/api/teams/${seed.teams.teamA.id}/members`,
      { email: "invited@example.com", role: "member" },
    );
    expect(response.status).toBe(403);
  });

  test("Team admin cannot delete the team (owner-only)", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.adminA.delete(
      `/api/teams/${seed.teams.teamA.id}`,
    );
    expect(response.status).toBe(403);
  });

  test("Team admin can list projects (member-level read)", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.adminA.get(
      `/api/teams/${seed.teams.teamA.id}/projects`,
    );
    expect(response.status).toBe(200);
  });

  test("Non-platform-admin cannot access admin status endpoint", async () => {
    const { client } = await getSecurityContext();
    const response = await client.memberA.get("/api/admin/status");
    expect(response.status).toBe(403);
  });

  test("Platform admin can access admin status endpoint", async () => {
    const { client } = await getSecurityContext();
    const response = await client.platformAdmin.get("/api/admin/status");
    expect(response.status).toBe(200);
  });

  test("Platform admin can read another team's projects without membership", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.platformAdmin.get(
      `/api/teams/${seed.teams.teamB.id}/projects`,
    );
    expect(response.status).toBe(200);
  });

  test("Outsider still cannot read another team's projects", async () => {
    const { seed, client } = await getSecurityContext();
    const response = await client.outsider.get(
      `/api/teams/${seed.teams.teamA.id}/projects`,
    );
    expect(response.status).toBe(403);
  });
});
