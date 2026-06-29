import { describe, expect, test } from "bun:test";
import { apiFetch, createApiClient } from "../e2e/fixtures/client";
import { SESSION_COOKIE } from "../e2e/fixtures/constants";
import { mintExpiredSession, mintSession } from "../e2e/fixtures/session";
import { getSecurityContext, useSecurityContext } from "./helpers";

useSecurityContext();

describe("Authentication and session security", () => {
  test("Unauthenticated request to protected endpoint returns 401", async () => {
    const { seed } = await getSecurityContext();
    const response = await createApiClient().get(`/api/teams/${seed.teams.teamA.id}`);
    expect(response.status).toBe(401);
  });

  test("Forged session token is rejected with 401", async () => {
    const { seed } = await getSecurityContext();
    const response = await createApiClient("deadbeef".repeat(8)).get(
      `/api/teams/${seed.teams.teamA.id}`,
    );
    expect(response.status).toBe(401);
  });

  test("Expired session token is rejected with 401", async () => {
    const { seed } = await getSecurityContext();
    const expired = await mintExpiredSession(seed.users.memberA.id);
    const response = await createApiClient(expired).get(`/api/teams/${seed.teams.teamA.id}`);
    expect(response.status).toBe(401);
  });

  test("Valid login sets httpOnly session cookie", async () => {
    const { seed } = await getSecurityContext();
    const response = await apiFetch("/api/auth/login/local", {
      method: "POST",
      body: JSON.stringify({
        email: seed.users.memberA.email,
        password: seed.password,
        mode: "login",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  test("Logout invalidates session for subsequent requests", async () => {
    const { seed } = await getSecurityContext();
    const token = await mintSession(seed.users.outsider.id);
    const authed = await createApiClient(token).get("/api/auth/me");
    expect(authed.status).toBe(200);
    const meBody = authed.body as { user: { email: string } | null };
    expect(meBody.user?.email).toBe(seed.users.outsider.email);

    const logout = await createApiClient(token).post("/api/auth/logout");
    expect(logout.status).toBe(200);

    const afterLogout = await createApiClient(token).get("/api/auth/me");
    const afterBody = afterLogout.body as { user: null | { email: string } };
    expect(afterBody.user).toBeNull();
  });

  test("Invalid credentials are rejected without revealing account existence details", async () => {
    const response = await apiFetch("/api/auth/login/local", {
      method: "POST",
      body: JSON.stringify({
        email: "nobody@example.com",
        password: "wrong-password",
        mode: "login",
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status).toBe(401);
  });
});
