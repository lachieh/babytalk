import { createReadyzCheckHandler } from "@babytalk/zpages/next";

import { zpages } from "@/app/(z-pages)/_lib/zpages";

export const GET = createReadyzCheckHandler(zpages);
