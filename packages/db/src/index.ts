import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

let client: ReturnType<typeof postgres> | null = null;
let db: Database | null = null;

export function createDb(connectionString?: string) {
  const url =
    connectionString ??
    process.env.DATABASE_URL ??
    "postgres://servicebeard:servicebeard@localhost:5432/servicebeard";

  const pgClient = postgres(url, { max: 10 });
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

export * from "./crypto";
export * from "./schema";
export * from "./seed-dev-account";
export * from "./sync-errors";

