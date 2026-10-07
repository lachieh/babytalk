import { createConfigHandler } from "@bubsie/standard-config/well-known/next";

import configDef from "@/config";

export const GET = createConfigHandler(configDef);
