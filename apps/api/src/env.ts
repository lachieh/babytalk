import { initDb } from "@bubsie/db";
import { runMigrations } from "@bubsie/db/migrate";
import { loadConfig } from "@bubsie/standard-config";

import configDef from "./config";

const loadOrExit = async () => {
  try {
    return await loadConfig(configDef);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(
      "\nSet the missing values as environment variables (e.g. BUBSIE_API_WEB_URL) or in .config/bubsie_api.yaml."
    );
    process.exit(1);
  }
};

export const config = await loadOrExit();

// Run migrations before starting the server (skip with SKIP_MIGRATIONS=1 for smoke tests).
if (!process.env.SKIP_MIGRATIONS) {
  const migrationsFolder =
    process.env.MIGRATIONS_PATH ?? "packages/db/src/migrations";
  await runMigrations(config.databaseUrl, migrationsFolder);
}
initDb(config.databaseUrl);
