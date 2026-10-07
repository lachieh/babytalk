import { loadConfig } from "@bubsie/standard-config";

import configDef from "./config";

export const config = await loadConfig(configDef);
