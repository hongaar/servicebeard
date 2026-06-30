import type { Page } from "@playwright/test";
import { loadSeedData } from "./fixtures/load-seed";
import type { SeedUserKey } from "./fixtures/types";

export async function authenticateAs(
  page: Page,
  userKey: SeedUserKey,
): Promise<void> {
  const seed = loadSeedData();
  const user = seed.users[userKey];

  const response = await page.request.post("/api/auth/login/local", {
    data: {
      email: user.email,
      password: seed.password,
      mode: "login",
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to authenticate as ${userKey}: HTTP ${response.status()}`,
    );
  }
}

export function seed() {
  return loadSeedData();
}
