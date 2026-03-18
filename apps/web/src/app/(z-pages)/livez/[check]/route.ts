import { createLivezCheckHandler } from "@babytalk/zpages/next";

import { zpages } from "@/zpages";

export const GET = createLivezCheckHandler(zpages);
