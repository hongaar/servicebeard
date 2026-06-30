import { loadExtensionManifest } from "@servicebeard/shared/extensions";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, formatPgNotice } from "./index";

const { db, client } = createDb(undefined, {
  onnotice: (notice) => {
    console.log(formatPgNotice(notice));
  },
});

console.log("Running OSS database migrations...");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("OSS migrations complete.");

const manifest = await loadExtensionManifest();
if (manifest) {
  for (const migration of manifest.migrations) {
    console.log(`Running extension migrations from ${migration.dir}...`);
    await migrate(db, {
      migrationsFolder: migration.dir,
      migrationsTable: migration.table,
    });
    console.log(`Extension migrations complete (table: ${migration.table}).`);
  }
}

await client.end();
console.log("All migrations complete.");
