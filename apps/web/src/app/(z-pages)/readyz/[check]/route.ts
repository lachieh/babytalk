import { createReadyzCheckHandler } from "@babytalk/zpages/next";

import { zpages } from "@/zpages";

export const GET = createReadyzCheckHandler(zpages);
