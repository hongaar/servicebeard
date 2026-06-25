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

export function findMonorepoRootDir(): string | null {
  return findMonorepoRoot(process.cwd()) ?? findMonorepoRoot(import.meta.dir);
}

/** Resolve env file paths relative to the monorepo root (where `.env` lives). */
export function resolveMonorepoPath(filePath: string): string {
  const trimmed = filePath.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    return resolve(trimmed);
  }
  const root = findMonorepoRootDir();
  if (root) return resolve(root, trimmed);
  return resolve(process.cwd(), trimmed);
}

function parseEnvFile(path: string, overwrite: boolean): void {
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

    if (overwrite || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadMonorepoEnv(): void {
  const overwrite = process.env.NODE_ENV !== "production";
  const root = findMonorepoRootDir();

  const candidates = [
    root ? resolve(root, ".env") : null,
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ].filter((path): path is string => path !== null);

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    parseEnvFile(path, overwrite);
    return;
  }
}
