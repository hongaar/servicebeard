import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_API_URL, DEFAULT_WEB_URL, STACK_PID_FILE } from "./constants";

const ROOT = join(fileURLToPath(import.meta.url), "../../../..");
const LOG_DIR = join(ROOT, "reports/integration");
const FETCH_TIMEOUT_MS = 10_000;
const STACK_READY_TIMEOUT_MS = Number(
  process.env.STACK_READY_TIMEOUT_MS ?? 180_000,
);

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

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function assertStackProcessesAlive(): void {
  const pids = readPids();
  const dead = pids.filter((pid) => !isProcessAlive(pid));
  if (dead.length === 0) return;

  throw new Error(
    `E2E stack process(es) exited (pids: ${dead.join(", ")}). Check logs in ${LOG_DIR}/`,
  );
}

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

async function waitForUrl(
  url: string,
  timeoutMs = STACK_READY_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts += 1;
    assertStackProcessesAlive();

    try {
      const response = await fetchWithTimeout(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }

    if (attempts === 1 || attempts % 20 === 0) {
      const remainingSec = Math.max(
        0,
        Math.round((deadline - Date.now()) / 1000),
      );
      console.log(`Waiting for ${url} (${remainingSec}s remaining)`);
    }

    await Bun.sleep(500);
  }

  throw new Error(
    `Timed out waiting for ${url} after ${timeoutMs}ms: ${String(lastError)}`,
  );
}

function readPids(): number[] {
  if (!existsSync(STACK_PID_FILE)) return [];
  return JSON.parse(readFileSync(STACK_PID_FILE, "utf8")) as number[];
}

function writePids(pids: number[]): void {
  writeFileSync(STACK_PID_FILE, JSON.stringify(pids), "utf8");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function stopPid(pid: number, signal: NodeJS.Signals = "SIGTERM"): void {
  try {
    process.kill(pid, signal);
  } catch {
    // process may already be gone
  }
}

function killListenersOnPort(port: number): void {
  const result = Bun.spawnSync(["lsof", "-ti", `:${port}`], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const output = result.stdout
    ? new TextDecoder().decode(result.stdout).trim()
    : "";
  if (!output) return;

  for (const pidText of output.split("\n")) {
    const pid = Number(pidText);
    if (Number.isFinite(pid) && pid > 0) {
      stopPid(pid, "SIGKILL");
    }
  }
}

function ensurePortsFree(): void {
  killListenersOnPort(Number(process.env.PORT ?? E2E_ENV.PORT ?? "3000"));
  killListenersOnPort(5173);
}

async function startStack(): Promise<void> {
  const env = stackEnv();
  mkdirSync(LOG_DIR, { recursive: true });
  ensurePortsFree();

  const spawn = async (args: string[], name: string): Promise<number> => {
    const logPath = join(LOG_DIR, `${name}.log`);
    const command = `nohup ${args.map(shellQuote).join(" ")} > ${shellQuote(logPath)} 2>&1 </dev/null & echo $!`;
    const proc = Bun.spawn(["/bin/sh", "-c", command], {
      cwd: ROOT,
      env,
      stdout: "pipe",
      stderr: "ignore",
      stdin: "ignore",
      detached: false,
    });
    const pidText = await new Response(proc.stdout).text();
    const pid = Number(pidText.trim());
    if (!Number.isFinite(pid) || pid <= 0) {
      throw new Error(
        `Failed to start ${name} (invalid pid: ${pidText.trim()})`,
      );
    }
    return pid;
  };

  const apiPid = await spawn(
    ["bun", "run", "--filter", "@servicebeard/api", "start"],
    "api",
  );
  const workerPid = await spawn(
    ["bun", "run", "--filter", "@servicebeard/worker", "start"],
    "worker",
  );
  const webPid = await spawn(
    ["bun", "run", "--filter", "@servicebeard/web", "dev"],
    "web",
  );

  writePids([apiPid, workerPid, webPid]);
  console.log(`Started e2e stack (pids: ${apiPid}, ${workerPid}, ${webPid})`);
  console.log(`Stack logs: ${LOG_DIR}/`);
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
  const pids = readPids();
  for (const pid of pids) {
    stopPid(pid, "SIGTERM");
  }

  // nohup-spawned filter wrappers can outlive the recorded pid; sweep known services.
  for (const pattern of [
    "@servicebeard/api start",
    "@servicebeard/worker start",
    "@servicebeard/web dev",
  ]) {
    Bun.spawnSync(["pkill", "-f", pattern], {
      stdout: "ignore",
      stderr: "ignore",
    });
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
