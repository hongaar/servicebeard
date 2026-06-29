import { existsSync, readFileSync } from "node:fs";
import { SEED_DATA_PATH } from "./constants";
import type { SeedData } from "./types";

export function loadSeedData(): SeedData {
  if (!existsSync(SEED_DATA_PATH)) {
    throw new Error(
      `Seed data not found at ${SEED_DATA_PATH}. Run: bun run test:integration:seed`,
    );
  }
  return JSON.parse(readFileSync(SEED_DATA_PATH, "utf8")) as SeedData;
}
