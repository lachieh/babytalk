import { initDb } from "@babytalk/db";
import { runMigrations } from "@babytalk/db/migrate";
import { loadConfig } from "@babytalk/standard-config";

import configDef from "./config";

export const config = await loadConfig(configDef);

// Run migrations before starting the server.
// In Docker, the migrations folder is copied alongside the dist output.
// In development, resolve relative to the db package source.
const migrationsFolder =
  process.env.MIGRATIONS_PATH ?? "packages/db/src/migrations";
await runMigrations(config.databaseUrl, migrationsFolder);
initDb(config.databaseUrl);
