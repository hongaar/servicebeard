import type { Hono } from "hono";
import { setEntitlementsProvider } from "./lib/entitlements";
import type { AppVariables } from "./middleware/auth";

export interface ExtensionContext {
  app: Hono<{ Variables: AppVariables }>;
  setEntitlementsProvider: typeof setEntitlementsProvider;
}

export interface ExtensionModule {
  register(ctx: ExtensionContext): void | Promise<void>;
}

export async function loadExtensions(ctx: ExtensionContext): Promise<void> {
  const modulePath = process.env.SB_EXTENSIONS_MODULE;
  if (!modulePath) return;

  const extension = (await import(modulePath)) as ExtensionModule;
  if (typeof extension.register !== "function") {
    throw new Error("SB_EXTENSIONS_MODULE must export a register function");
  }

  await extension.register(ctx);
}
