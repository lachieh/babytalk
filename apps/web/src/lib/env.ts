import { loadConfig } from "@bubsie/standard-config";

import configDef from "@/config";

export const getConfig = () => loadConfig(configDef);
