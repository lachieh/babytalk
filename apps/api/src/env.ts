import { initDb } from "@babytalk/db";
import { runMigrations } from "@babytalk/db/migrate";
import { loadConfig } from "@babytalk/standard-config";

import configDef from "./config";

export const config = await loadConfig(configDef);

// Run migrations before starting the server (skip with SKIP_MIGRATIONS=1 for smoke tests).
if (!process.env.SKIP_MIGRATIONS) {
  const migrationsFolder =
    process.env.MIGRATIONS_PATH ?? "packages/db/src/migrations";
  await runMigrations(config.databaseUrl, migrationsFolder);
}
initDb(config.databaseUrl);
