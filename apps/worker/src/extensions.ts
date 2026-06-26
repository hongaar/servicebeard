import { loadExtensionManifest } from "@servicebeard/shared/extensions";
import type { WorkerExtensionContext, WorkerExtensionModule } from "@servicebeard/shared/extensions";
import type PgBoss from "pg-boss";

export type { WorkerExtensionContext, WorkerExtensionModule } from "@servicebeard/shared/extensions";

export async function loadWorkerExtensions(ctx: { boss: PgBoss }): Promise<void> {
  const manifest = await loadExtensionManifest();
  if (!manifest) return;

  const extension = (await import(manifest.api)) as WorkerExtensionModule;
  if (typeof extension.register !== "function") {
    throw new Error("Extension api module must export a register function");
  }

  await extension.register(ctx as WorkerExtensionContext);
}
