export type ProviderLogFn = (
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
) => void;

let providerLog: ProviderLogFn | null = null;

export function setProviderLog(fn: ProviderLogFn | null): void {
  providerLog = fn;
}

export function logProvider(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
): void {
  providerLog?.(level, message, context);
}
