import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url));

export const E2E_PASSWORD = "E2eTestPass1!";

export const E2E_USERS = {
  ownerA: { email: "e2e-owner-a@test.local", name: "E2E Owner A" },
  adminA: { email: "e2e-admin-a@test.local", name: "E2E Admin A" },
  memberA: { email: "e2e-member-a@test.local", name: "E2E Member A" },
  ownerB: { email: "e2e-owner-b@test.local", name: "E2E Owner B" },
  outsider: { email: "e2e-outsider@test.local", name: "E2E Outsider" },
  platformAdmin: { email: "e2e-platform-admin@test.local", name: "E2E Platform Admin" },
} as const;

export const E2E_TEAMS = {
  teamA: { name: "E2E Team A", slug: "e2e-team-a" },
  teamB: { name: "E2E Team B", slug: "e2e-team-b" },
} as const;

export const E2E_PROJECTS = {
  projectA: { name: "E2E Project A", slug: "e2e-project-a" },
  projectB: { name: "E2E Project B", slug: "e2e-project-b" },
} as const;

export const E2E_RULES = {
  ruleA: { name: "E2E Rule A" },
  ruleB: { name: "E2E Rule B" },
} as const;

export const E2E_THREAD = {
  threadA: {
    externalIssueId: "e2e-issue-1001",
    issueIid: 1,
    issueUrl: "https://gitlab.example.com/e2e/issues/1",
    originalSenderEmail: "customer@example.com",
    originalSenderName: "E2E Customer",
    subjectNormalized: "e2e support request",
    subject: "E2E Support Request",
  },
  threadB: {
    externalIssueId: "e2e-issue-2002",
    issueIid: 2,
    issueUrl: "https://gitlab.example.com/e2e/issues/2",
    originalSenderEmail: "other@example.com",
    originalSenderName: "Other Customer",
    subjectNormalized: "e2e team b request",
    subject: "E2E Team B Request",
  },
} as const;

export function localExternalSub(email: string): string {
  return `local:${email.toLowerCase()}`;
}

export const SESSION_COOKIE = "sd_session";

export const DEFAULT_API_URL = "http://localhost:3000";
export const DEFAULT_WEB_URL = "http://127.0.0.1:5173";

export const SEED_DATA_PATH = join(FIXTURES_DIR, "seed-data.json");
export const STACK_PID_FILE = join(FIXTURES_DIR, "../../.e2e-stack.pids");
