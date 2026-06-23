import { existsSync, readFileSync } from "node:fs";
import type { ProviderConfig } from "./types";

function readGlobalCaBundle(): string | undefined {
  const path = process.env.TLS_CA_BUNDLE;
  if (!path || !existsSync(path)) return undefined;
  return readFileSync(path, "utf8");
}

export function buildTlsOptions(config: ProviderConfig): Record<string, unknown> | undefined {
  const tls: Record<string, unknown> = {};

  if (config.tlsInsecure) {
    tls.rejectUnauthorized = false;
  }

  const caParts: string[] = [];
  const globalCa = readGlobalCaBundle();
  if (globalCa) caParts.push(globalCa);
  if (config.caCert?.trim()) caParts.push(config.caCert.trim());

  if (caParts.length > 0) {
    tls.ca = caParts.join("\n");
  }

  return Object.keys(tls).length > 0 ? tls : undefined;
}

export function providerFetch(
  config: ProviderConfig,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const tls = buildTlsOptions(config);
  return fetch(url, tls ? { ...init, tls } : init);
}
