import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./index";

const { db, client } = createDb();

console.log("Running migrations...");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete.");
await client.end();
