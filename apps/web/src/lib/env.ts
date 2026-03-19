import { loadConfig } from "@babytalk/standard-config";

import configDef from "@/config";

export const getConfig = () => loadConfig(configDef);
