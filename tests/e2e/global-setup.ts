import { spawnSync } from "node:child_process";
import { join } from "node:path";

export default async function globalSetup(): Promise<void> {
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgres://servicebeard:servicebeard@localhost:5432/servicebeard";
  }

  const result = spawnSync(
    "bun",
    [join(import.meta.dirname, "fixtures/seed.ts")],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    throw new Error("Failed to seed e2e test data");
  }
}
