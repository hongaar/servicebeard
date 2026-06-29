import { describe, expect, test } from "bun:test";
import { apiFetch } from "../e2e/fixtures/client";
import { getSecurityContext, useSecurityContext } from "./helpers";

useSecurityContext();

function gitlabWebhookPayload(externalIssueId: string) {
  return {
    object_kind: "note",
    object_attributes: {
      noteable_type: "Issue",
      id: 424242,
      note: "E2E webhook security test comment",
      system: false,
      internal: false,
      created_at: new Date().toISOString(),
    },
    issue: {
      id: Number(externalIssueId.replace(/\D/g, "")) || 1001,
      iid: 1,
    },
    user: {
      id: 1,
      name: "Webhook Tester",
      username: "webhook-tester",
    },
  };
}

describe("Webhook authentication and signature verification", () => {
  test("GitLab webhook with missing token is rejected", async () => {
    const { seed } = await getSecurityContext();
    const body = JSON.stringify(gitlabWebhookPayload(seed.threads.threadA.externalIssueId));
    const response = await apiFetch(`/webhooks/gitlab/${seed.projects.projectA.id}`, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status).toBe(401);
  });

  test("GitLab webhook with invalid token is rejected", async () => {
    const { seed } = await getSecurityContext();
    const body = JSON.stringify(gitlabWebhookPayload(seed.threads.threadA.externalIssueId));
    const response = await apiFetch(`/webhooks/gitlab/${seed.projects.projectA.id}`, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "X-Gitlab-Token": "invalid-secret",
      },
    });
    expect(response.status).toBe(401);
  });

  test("GitLab webhook with valid token is accepted and queued", async () => {
    const { seed } = await getSecurityContext();
    const body = JSON.stringify(gitlabWebhookPayload(seed.threads.threadA.externalIssueId));
    const response = await apiFetch(`/webhooks/gitlab/${seed.projects.projectA.id}`, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "X-Gitlab-Token": seed.projects.projectA.webhookSecret,
      },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test("Unknown projectId returns consistent 404 for webhooks", async () => {
    const unknownId = crypto.randomUUID();
    const body = JSON.stringify(gitlabWebhookPayload("9999"));
    const response = await apiFetch(`/webhooks/gitlab/${unknownId}`, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "X-Gitlab-Token": "anything",
      },
    });
    expect(response.status).toBe(404);
  });

  test("GitHub webhook endpoint rejects wrong provider project", async () => {
    const { seed } = await getSecurityContext();
    const body = JSON.stringify({ action: "created" });
    const response = await apiFetch(`/webhooks/github/${seed.projects.projectA.id}`, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "sha256=deadbeef",
      },
    });
    expect(response.status).toBe(404);
  });
});
