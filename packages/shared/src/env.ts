import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function findMonorepoRoot(startDir: string): string | null {
  let dir = startDir;
  while (dir !== resolve(dir, "..")) {
    if (
      existsSync(resolve(dir, "package.json")) &&
      existsSync(resolve(dir, "apps")) &&
      existsSync(resolve(dir, "packages"))
    ) {
      return dir;
    }
    dir = resolve(dir, "..");
  }
  return null;
}

function parseEnvFile(path: string): void {
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadMonorepoEnv(): void {
  const root =
    findMonorepoRoot(process.cwd()) ?? findMonorepoRoot(import.meta.dir);

  const candidates = [
    root ? resolve(root, ".env") : null,
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ].filter((path): path is string => path !== null);

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    parseEnvFile(path);
    return;
  }
}
