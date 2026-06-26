import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveManifestPath(manifestPath: string): string {
  if (path.isAbsolute(manifestPath)) return manifestPath;

  const searchBases: string[] = [];
  let current = process.cwd();
  while (true) {
    searchBases.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  for (const base of searchBases) {
    const resolved = path.resolve(base, manifestPath);
    if (existsSync(resolved)) return resolved;
  }

  return path.resolve(process.cwd(), manifestPath);
}

async function resolveExtensionsAlias(): Promise<string> {
  const manifestPath = process.env.SB_EXTENSION_MANIFEST;
  if (!manifestPath) {
    return path.resolve(__dirname, "src/extensions/index.tsx");
  }

  const absoluteManifestPath = resolveManifestPath(manifestPath);
  const mod = (await import(absoluteManifestPath)) as { default?: { web?: string }; web?: string };
  const raw = mod.default ?? mod;
  const webEntry = raw.web;
  if (!webEntry || typeof webEntry !== "string") {
    throw new Error("Extension manifest must include a web entry path");
  }

  return path.resolve(path.dirname(absoluteManifestPath), webEntry);
}

export default defineConfig(async () => {
  const extensionsAlias = await resolveExtensionsAlias();
  const monorepoRoot = path.resolve(__dirname, "../..");

  return {
    plugins: [react()],
    envDir: monorepoRoot,
    envPrefix: ["VITE_", "CLOUD_PLAN_"],
    resolve: {
      alias: {
        "@extensions": extensionsAlias,
        "@servicebeard/web": path.resolve(__dirname, "src"),
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
    },
  };
});
