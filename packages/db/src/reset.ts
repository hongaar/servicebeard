import { loadMonorepoEnv } from "@servicebeard/shared/env";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "./index";
import {
    DEV_ACCOUNT_EMAIL,
    DEV_ACCOUNT_PASSWORD,
    seedDevLocalAccount,
} from "./seed-dev-account";

loadMonorepoEnv();

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset database in production (NODE_ENV=production).");
  process.exit(1);
}

const db = getDb();

console.log("Resetting database (all teams, projects, and users)...");

await db.execute(sql`
  TRUNCATE TABLE
    email_messages,
    issue_threads,
    rules,
    job_runs,
    audit_log,
    projects,
    team_invites,
    team_members,
    teams,
    webauthn_challenges,
    webauthn_credentials,
    sessions,
    users
  RESTART IDENTITY CASCADE
`);

console.log("Database reset complete.");

const seedResult = await seedDevLocalAccount();
if (seedResult === "created") {
  console.log(`Seeded dev account: ${DEV_ACCOUNT_EMAIL} / ${DEV_ACCOUNT_PASSWORD}`);
} else if (seedResult === "skipped" && process.env.LOCAL_LOGIN !== "true") {
  console.log("Dev account seed skipped (LOCAL_LOGIN is not true).");
} else if (seedResult === "skipped") {
  console.log("Dev account seed skipped.");
}

await closeDb();
