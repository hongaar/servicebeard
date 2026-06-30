import { createDb } from "@servicebeard/db";
import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { apiFetch } from "../e2e/fixtures/client";
import { getSecurityContext, useSecurityContext } from "./helpers";

useSecurityContext();

function gitlabWebhookPayload(externalIssueId: string) {
  const numericId = Number(externalIssueId.replace(/\D/g, "")) || 1001;
  return {
    object_kind: "note",
    object_attributes: {
      noteable_type: "Issue",
      id: Date.now(),
      note: "Worker pipeline e2e test",
      system: false,
      internal: false,
      created_at: new Date().toISOString(),
    },
    issue: {
      id: numericId,
      iid: 1,
    },
    user: {
      id: 42,
      name: "Worker Test",
      username: "worker-test",
    },
  };
}

async function waitForSendEmailJob(
  projectId: string,
  timeoutMs = 30_000,
): Promise<boolean> {
  const { db } = createDb();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const rows = await db.execute<{ state: string }>(sql`
      SELECT state
      FROM pgboss.job
      WHERE name = 'send-email'
        AND data->>'projectId' = ${projectId}
      ORDER BY created_on DESC
      LIMIT 1
    `);

    const row = rows[0];
    if (row && ["completed", "failed", "active", "retry"].includes(row.state)) {
      return true;
    }

    await Bun.sleep(500);
  }

  return false;
}

describe("Worker and database pipeline integration", () => {
  test("Valid webhook enqueues send-email job processed by worker for the correct project", async () => {
    const { seed } = await getSecurityContext();
    const payload = gitlabWebhookPayload(seed.threads.threadA.externalIssueId);
    const body = JSON.stringify(payload);

    const response = await apiFetch(
      `/webhooks/gitlab/${seed.projects.projectA.id}`,
      {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "X-Gitlab-Token": seed.projects.projectA.webhookSecret,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });

    const jobSeen = await waitForSendEmailJob(seed.projects.projectA.id);
    expect(jobSeen).toBe(true);
  });

  test("Webhook for Team B project does not enqueue jobs scoped to Team A project", async () => {
    const { seed } = await getSecurityContext();
    const payload = gitlabWebhookPayload(seed.threads.threadB.externalIssueId);
    const body = JSON.stringify(payload);

    const response = await apiFetch(
      `/webhooks/gitlab/${seed.projects.projectB.id}`,
      {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "X-Gitlab-Token": seed.projects.projectB.webhookSecret,
        },
      },
    );

    expect(response.status).toBe(200);

    const { db } = createDb();
    const rows = await db.execute<{ project_id: string | null }>(sql`
      SELECT data->>'projectId' AS project_id
      FROM pgboss.job
      WHERE name = 'send-email'
        AND data->>'projectId' = ${seed.projects.projectB.id}
      ORDER BY created_on DESC
      LIMIT 1
    `);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.project_id).toBe(seed.projects.projectB.id);
    expect(rows[0]?.project_id).not.toBe(seed.projects.projectA.id);
  });
});
