import { createConfigHandler } from "@babytalk/standard-config/well-known/next";

import configDef from "@/config";

export const GET = createConfigHandler(configDef);
