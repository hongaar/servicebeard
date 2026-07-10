import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { ResolvedExtensionManifest } from "./manifest";

/** Merges extension `public` assets into the web app public directory. */
export function copyExtensionPublicAssets(
  manifest: ResolvedExtensionManifest,
  webPublicRoot: string,
): { copied: boolean; source?: string } {
  const sourceDir = manifest.public;
  if (!sourceDir || !existsSync(sourceDir)) {
    return { copied: false };
  }

  mkdirSync(webPublicRoot, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const from = resolve(sourceDir, entry.name);
    const to = resolve(webPublicRoot, entry.name);
    cpSync(from, to, { recursive: true, force: true });
  }

  return { copied: true, source: sourceDir };
}
