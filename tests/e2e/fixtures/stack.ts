import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_API_URL, DEFAULT_WEB_URL, STACK_PID_FILE } from "./constants";

const ROOT = join(fileURLToPath(import.meta.url), "../../..");

const E2E_ENV: Record<string, string> = {
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
  API_URL: process.env.API_URL ?? DEFAULT_API_URL,
  WEB_URL: process.env.WEB_URL ?? DEFAULT_WEB_URL,
  PORT: process.env.PORT ?? "3000",
};

function stackEnv(): Record<string, string> {
  return { ...process.env, ...E2E_ENV };
}

async function waitForUrl(url: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    await Bun.sleep(500);
  }

  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

function readPids(): number[] {
  if (!existsSync(STACK_PID_FILE)) return [];
  return JSON.parse(readFileSync(STACK_PID_FILE, "utf8")) as number[];
}

function writePids(pids: number[]): void {
  writeFileSync(STACK_PID_FILE, JSON.stringify(pids), "utf8");
}

async function startStack(): Promise<void> {
  const env = stackEnv();

  const spawnOpts = {
    cwd: ROOT,
    env,
    stdout: "ignore" as const,
    stderr: "ignore" as const,
    stdin: "ignore" as const,
    detached: true,
  };

  const api = Bun.spawn(["bun", "run", "--filter", "@servicebeard/api", "start"], spawnOpts);
  const worker = Bun.spawn(["bun", "run", "--filter", "@servicebeard/worker", "start"], spawnOpts);
  const web = Bun.spawn(["bun", "run", "--filter", "@servicebeard/web", "dev"], spawnOpts);

  writePids([api.pid, worker.pid, web.pid]);
  console.log(`Started e2e stack (pids: ${api.pid}, ${worker.pid}, ${web.pid})`);
}

async function startAndWaitStack(): Promise<void> {
  await startStack();
  await waitStack();
}

async function waitStack(): Promise<void> {
  const env = stackEnv();
  const apiUrl = env.API_URL ?? DEFAULT_API_URL;
  const webUrl = env.WEB_URL ?? DEFAULT_WEB_URL;
  await waitForUrl(`${apiUrl.replace(/\/$/, "")}/readyz`);
  await waitForUrl(webUrl);
  console.log("E2E stack is ready");
}

function stopStack(): void {
  for (const pid of readPids()) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // process may already be gone
    }
  }
  if (existsSync(STACK_PID_FILE)) {
    unlinkSync(STACK_PID_FILE);
  }
  console.log("Stopped e2e stack");
}

const command = process.argv[2] ?? "start";

if (import.meta.main) {
  const run = async () => {
    switch (command) {
      case "start":
        await startStack();
        break;
      case "up":
        await startAndWaitStack();
        break;
      case "wait":
        await waitStack();
        break;
      case "stop":
        stopStack();
        break;
      default:
        console.error(`Unknown command: ${command}. Use start|up|wait|stop`);
        process.exit(1);
    }
  };

  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { stackEnv, startAndWaitStack, startStack, stopStack, waitStack };

