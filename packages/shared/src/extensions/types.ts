export type {
  EntitlementsProvider,
  TeamAccessContext,
  TeamEntitlementUsage,
  TeamListingMeta,
} from "../entitlements";

export interface ExtensionApp {
  route(path: string, handler: unknown): void;
}

export interface ExtensionContext {
  app: ExtensionApp;
  setEntitlementsProvider: (
    provider: import("../entitlements").EntitlementsProvider,
  ) => void;
}

export interface ExtensionModule {
  register(ctx: ExtensionContext): void | Promise<void>;
}

export interface WorkerExtensionContext {
  boss: {
    createQueue(name: string, options?: { name?: string; policy?: string }): Promise<void>;
    schedule(
      name: string,
      cron: string,
      data: Record<string, unknown>,
      options?: { tz?: string },
    ): Promise<void>;
    work<T>(
      name: string,
      options: { batchSize: number },
      handler: (jobs: Array<{ data: T }>) => Promise<void>,
    ): void;
  };
}

export interface WorkerExtensionModule {
  register(ctx: WorkerExtensionContext): void | Promise<void>;
}
