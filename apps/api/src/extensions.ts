import { loadExtensionManifest } from "@servicebeard/shared/extensions";
import type { ExtensionContext, ExtensionModule } from "@servicebeard/shared/extensions";
import { setEntitlementsProvider } from "./lib/entitlements";
import type { AppVariables } from "./middleware/auth";
import type { Hono } from "hono";

export type { ExtensionContext, ExtensionModule } from "@servicebeard/shared/extensions";

export async function loadExtensions(
  ctx: Omit<ExtensionContext, "app"> & {
    app: Hono<{ Variables: AppVariables }>;
  },
): Promise<void> {
  const manifest = await loadExtensionManifest();
  if (!manifest) return;

  const extension = (await import(manifest.api)) as ExtensionModule;
  if (typeof extension.register !== "function") {
    throw new Error("Extension api module must export a register function");
  }

  await extension.register(ctx);
}

export { setEntitlementsProvider };
