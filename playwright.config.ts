import { defineConfig, devices } from "@playwright/test";
import {
  DEFAULT_API_URL,
  DEFAULT_WEB_URL,
} from "./tests/e2e/fixtures/constants";

const apiUrl = process.env.API_URL ?? DEFAULT_API_URL;
const webUrl = process.env.WEB_URL ?? DEFAULT_WEB_URL;

const e2eEnv = {
  NODE_ENV: "test",
  LOCAL_LOGIN: "true",
  LOCAL_LOGIN_SIGNUP: "true",
  GITHUB_LOGIN: "false",
  GITLAB_LOGIN: "false",
  OIDC_LOGIN: "false",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgres://servicebeard:servicebeard@localhost:5432/servicebeard",
  ENCRYPTION_KEY:
    process.env.ENCRYPTION_KEY ??
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "e2e-session-secret",
  API_URL: apiUrl,
  WEB_URL: webUrl,
  PORT: process.env.PORT ?? "3000",
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/playwright", open: "never" }],
    ["json", { outputFile: "reports/playwright/results.json" }],
  ],
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "bun run --filter @servicebeard/api start",
      url: `${apiUrl.replace(/\/$/, "")}/readyz`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: e2eEnv,
    },
    {
      command: "bun run --filter @servicebeard/worker start",
      stdout: /Worker started/,
      reuseExistingServer: true,
      timeout: 120_000,
      env: e2eEnv,
    },
    {
      command: "bun run --filter @servicebeard/web dev",
      url: webUrl,
      reuseExistingServer: true,
      timeout: 120_000,
      env: e2eEnv,
    },
  ],
});
