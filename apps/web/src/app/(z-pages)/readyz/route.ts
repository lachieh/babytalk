import { createReadyzHandler } from "@babytalk/zpages/next";

import { zpages } from "@/zpages";

export const GET = createReadyzHandler(zpages);
