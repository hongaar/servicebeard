import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadExtensionManifest } from "@servicebeard/shared/extensions";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function resolveExtensionsAlias(): Promise<string> {
  const manifest = await loadExtensionManifest();
  if (manifest) return manifest.web;
  return path.resolve(__dirname, "src/extensions/index.tsx");
}

export default defineConfig(async () => {
  const extensionsAlias = await resolveExtensionsAlias();

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@extensions": extensionsAlias,
        "@servicebeard/web": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 5173,
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
