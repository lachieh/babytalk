import { loadConfig } from "@babytalk/standard-config";

import configDef from "./config";

export const config = await loadConfig(configDef);
