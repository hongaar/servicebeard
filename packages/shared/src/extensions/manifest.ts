import path from "node:path";
import { z } from "zod";

export const extensionMigrationSchema = z.object({
  dir: z.string(),
  table: z.string().optional(),
});

export const extensionManifestSchema = z.object({
  api: z.string(),
  web: z.string(),
  migrations: z.array(extensionMigrationSchema).default([]),
});

export type ExtensionManifest = z.infer<typeof extensionManifestSchema>;

export interface ResolvedExtensionMigration {
  dir: string;
  table: string;
}

export interface ResolvedExtensionManifest {
  /** Absolute path to the manifest file. */
  manifestPath: string;
  /** Root directory for resolving relative paths (parent of manifest). */
  root: string;
  api: string;
  web: string;
  migrations: ResolvedExtensionMigration[];
}

function resolveManifestPath(manifestPath: string): string {
  return path.isAbsolute(manifestPath) ? manifestPath : path.resolve(process.cwd(), manifestPath);
}

export function parseExtensionManifest(
  raw: unknown,
  manifestPath: string,
): ResolvedExtensionManifest {
  const absoluteManifestPath = resolveManifestPath(manifestPath);
  const root = path.dirname(absoluteManifestPath);
  const parsed = extensionManifestSchema.parse(raw);

  return {
    manifestPath: absoluteManifestPath,
    root,
    api: path.resolve(root, parsed.api),
    web: path.resolve(root, parsed.web),
    migrations: parsed.migrations.map((migration) => ({
      dir: path.resolve(root, migration.dir),
      table: migration.table ?? "__drizzle_migrations_extension",
    })),
  };
}

export async function loadExtensionManifest(): Promise<ResolvedExtensionManifest | null> {
  const manifestPath = process.env.SB_EXTENSION_MANIFEST;
  if (!manifestPath) return null;

  const absolutePath = resolveManifestPath(manifestPath);
  const mod = (await import(absolutePath)) as { default?: unknown };
  const raw = mod.default ?? mod;
  return parseExtensionManifest(raw, absolutePath);
}

export function getExtensionManifestPath(): string | null {
  const manifestPath = process.env.SB_EXTENSION_MANIFEST;
  if (!manifestPath) return null;
  return resolveManifestPath(manifestPath);
}
