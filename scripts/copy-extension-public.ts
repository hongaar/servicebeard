#!/usr/bin/env bun
import {
  copyExtensionPublicAssets,
  loadExtensionManifest,
} from "@servicebeard/shared/extensions";

const targetDir = process.argv[2];
if (!targetDir) {
  console.error(
    "Usage: bun run scripts/copy-extension-public.ts <web-public-dir>",
  );
  process.exit(1);
}

const manifest = await loadExtensionManifest();
if (!manifest) {
  console.log("No extension manifest — skipping public asset copy.");
  process.exit(0);
}

const result = copyExtensionPublicAssets(manifest, targetDir);
if (!result.copied) {
  console.log("Extension manifest has no public assets — skipping.");
  process.exit(0);
}

console.log(
  `Copied extension public assets from ${result.source} to ${targetDir}`,
);
