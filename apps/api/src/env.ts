import { loadConfig } from "@babytalk/standard-config";

import configDef from "./config.js";

export const config = await loadConfig(configDef);
