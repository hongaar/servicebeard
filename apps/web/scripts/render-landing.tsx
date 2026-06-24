import react from "@vitejs/plugin-react";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build, type Plugin } from "vite";

const webRoot = join(import.meta.dirname, "..");
const outDir = join(webRoot, "landing-dist");
const tmpDir = join(webRoot, ".landing-build-tmp");

let collectedCss = "";

const collectCssPlugin = (): Plugin => ({
  name: "collect-landing-css",
  enforce: "post",
  generateBundle(_outputOptions, bundle) {
    const cssParts: string[] = [];
    for (const chunk of Object.values(bundle)) {
      if (
        chunk.type === "asset" &&
        typeof chunk.source === "string" &&
        chunk.fileName.endsWith(".css")
      ) {
        cssParts.push(chunk.source);
      }
    }
    collectedCss = cssParts.join("\n");
  },
});

await rm(tmpDir, { recursive: true, force: true });

await build({
  root: webRoot,
  configFile: false,
  plugins: [react(), collectCssPlugin()],
  build: {
    ssr: join(webRoot, "scripts/render-landing-ssr.tsx"),
    outDir: tmpDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "render.js",
      },
    },
  },
});

if (!collectedCss) {
  const files = await readdir(tmpDir);
  const cssFile = files.find((file) => file.endsWith(".css"));
  if (cssFile) {
    collectedCss = await readFile(join(tmpDir, cssFile), "utf8");
  }
}

if (!collectedCss) {
  throw new Error("No CSS was emitted for the landing page build.");
}

const { renderLandingHtml } = await import(pathToFileURL(join(tmpDir, "render.js")).href);
const body = renderLandingHtml();

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <meta
      name="description"
      content="ServiceBeard syncs project mailboxes with issue trackers. Open source, self-hostable, with a managed cloud version coming soon."
    />
    <title>ServiceBeard — Mailbox ↔ issue sync</title>
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
      rel="stylesheet"
    />
    <style>${collectedCss}</style>
  </head>
  <body>
    ${body}
  </body>
</html>
`;

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "index.html"), html, "utf8");
await copyFile(join(webRoot, "public", "favicon.png"), join(outDir, "favicon.png"));
await rm(tmpDir, { recursive: true, force: true });

console.log(`Wrote ${join(outDir, "index.html")}`);
console.log(`Wrote ${join(outDir, "favicon.png")}`);
console.log("Deploy: vercel (repo root vercel.json) or cd apps/web && vercel");
