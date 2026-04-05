import { initDb } from "@babytalk/db";
import { loadConfig } from "@babytalk/standard-config";

import configDef from "./config";

export const config = await loadConfig(configDef);

initDb(config.databaseUrl);
