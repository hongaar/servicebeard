/**
 * Preload in dev (`bun --preload …`) so Bun --watch restarts when the monorepo .env changes.
 * Values are applied at runtime via loadMonorepoEnv().
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(import.meta.dir, "../../../.env");

if (existsSync(envPath)) {
  await import(envPath, { with: { type: "text" } });
}
