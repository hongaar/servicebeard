import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

let client: ReturnType<typeof postgres> | null = null;
let db: Database | null = null;

export function formatPgNotice(notice: postgres.Notice): string {
  const severity = notice.severity ?? "NOTICE";
  const code = notice.code ? `[${notice.code}]` : "";
  const message = notice.message ?? "";
  return `${severity} ${code}: ${message}`.replace(/: $/, "");
}

export function createDb(
  connectionString?: string,
  postgresOptions?: postgres.Options<Record<string, postgres.PostgresType>>,
) {
  const url =
    connectionString ??
    process.env.DATABASE_URL ??
    "postgres://servicebeard:servicebeard@localhost:5432/servicebeard";

  const pgClient = postgres(url, { max: 10, ...postgresOptions });
  const database = drizzle(pgClient, { schema });
  return { db: database, client: pgClient };
}

export function getDb(): Database {
  if (!db) {
    const instance = createDb();
    client = instance.client;
    db = instance.db;
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

export * from "./admin-overview";
export * from "./audit-log";
export * from "./crypto";
export * from "./global-search";
export * from "./message-volume";
export * from "./project-status-events";
export * from "./schema";
export * from "./seed-dev-account";

export { and, asc, count, eq, gte, lt, sql } from "drizzle-orm";
