import { defineConfig } from "@babytalk/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "babytalk_web",
  public: ["apiUrl", "tamboUrl", "tamboApiKey"],
  publicPrefix: "NEXT_PUBLIC_",
  schema: z.object({
    apiUrl: z.string().default("http://localhost:4000/graphql"),
    tamboApiKey: z.string().default(""),
    tamboUrl: z.string().default("http://localhost:8261"),
  }),
});
