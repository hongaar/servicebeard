import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";

const UMAMI_SCRIPT_URL = "https://cloud.umami.is/script.js";

function umamiPlugin(websiteId: string | undefined): Plugin {
  return {
    name: "umami-analytics",
    transformIndexHtml(html) {
      if (!websiteId) return html;
      return html.replace(
        "</head>",
        `    <script defer src="${UMAMI_SCRIPT_URL}" data-website-id="${websiteId}"></script>\n  </head>`,
      );
    },
  };
}

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

export default defineConfig(async ({ mode }) => {
  const extensionsAlias = await resolveExtensionsAlias();
  const monorepoRoot = path.resolve(__dirname, "../..");
  const sharedNodeModules = path.resolve(monorepoRoot, "node_modules");
  const env = loadEnv(mode, monorepoRoot, "");
  const umamiWebsiteId = env.VITE_UMAMI_WEBSITE_ID;

  // Embedded in the web bundle at build time. deploy/compose/extract-vite-env.ts
  // reads these prefixes when generating .env.vite for Docker builds.
  const envPrefix = ["VITE_", "CLOUD_PLAN_"] as const;

  const sharedDep = (pkg: string) => {
    const nested = path.resolve(__dirname, "node_modules", pkg);
    if (existsSync(nested)) return nested;
    return path.resolve(sharedNodeModules, pkg);
  };

  return {
    plugins: [react(), umamiPlugin(umamiWebsiteId)],
    envDir: monorepoRoot,
    envPrefix: [...envPrefix],
    resolve: {
      alias: {
        "@extensions": extensionsAlias,
        "@servicebeard/web": path.resolve(__dirname, "src"),
        // Extension packages must share the same React Query / Router instances as the app.
        react: sharedDep("react"),
        "react-dom": sharedDep("react-dom"),
        "@tanstack/react-query": sharedDep("@tanstack/react-query"),
        "@tanstack/react-router": sharedDep("@tanstack/react-router"),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/react-router"],
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
