#!/usr/bin/env bun
/**
 * Extract Vite build-time variables from a Compose .env file.
 * Prefixes come from apps/web/vite.config.ts envPrefix (single source of truth).
 *
 * Usage:
 *   bun run deploy/compose/extract-vite-env.ts [input.env] [output.env.vite]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import viteConfig from "../../apps/web/vite.config.ts";

const repoRoot = resolve(import.meta.dir, "../..");
const input = resolve(
  process.argv[2] ?? resolve(repoRoot, "deploy/compose/.env"),
);
const output = resolve(
  process.argv[3] ?? resolve(repoRoot, "deploy/compose/.env.vite"),
);

const config = await viteConfig({ mode: "production", command: "build" });
const rawPrefix = config.envPrefix ?? "VITE_";
const prefixes = (Array.isArray(rawPrefix) ? rawPrefix : [rawPrefix]).map(
  String,
);

const lines = readFileSync(input, "utf8").split("\n");
const matched = lines.filter((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return false;
  const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
  if (!key) return false;
  return prefixes.some((prefix) => key.startsWith(prefix));
});

writeFileSync(output, matched.length > 0 ? `${matched.join("\n")}\n` : "");

const label = output.startsWith(repoRoot)
  ? output.slice(repoRoot.length + 1)
  : output;
console.log(`Wrote ${matched.length} Vite env var(s) to ${label}`);
