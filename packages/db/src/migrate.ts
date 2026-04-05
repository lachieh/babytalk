import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db, initDb } from "./client";

/**
 * Run all pending Drizzle migrations.
 * Call this before starting the server to ensure the schema is up to date.
 *
 * @param connectionString - PostgreSQL connection string
 * @param migrationsFolder - Path to the migrations folder (default: adjacent to this file)
 */
export const runMigrations = async (
  connectionString: string,
  migrationsFolder?: string
): Promise<void> => {
  initDb(connectionString);
  const folder =
    migrationsFolder ?? new URL("migrations", import.meta.url).pathname;

  console.log(`[db] Running migrations from ${folder}...`);
  await migrate(db, { migrationsFolder: folder });
  console.log("[db] Migrations complete.");
};
