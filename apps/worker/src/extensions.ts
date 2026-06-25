import type PgBoss from "pg-boss";

export interface WorkerExtensionContext {
  boss: PgBoss;
}

export interface WorkerExtensionModule {
  register(ctx: WorkerExtensionContext): void | Promise<void>;
}

export async function loadWorkerExtensions(ctx: WorkerExtensionContext): Promise<void> {
  const modulePath = process.env.SB_EXTENSIONS_MODULE;
  if (!modulePath) return;

  const extension = (await import(modulePath)) as WorkerExtensionModule;
  if (typeof extension.register !== "function") {
    throw new Error("SB_EXTENSIONS_MODULE must export a register function");
  }

  await extension.register(ctx);
}
