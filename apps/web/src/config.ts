import { defineConfig } from "@babytalk/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "babytalk_web",
  public: ["api_url", "tambo_url", "tambo_api_key"],
  publicPrefix: "NEXT_PUBLIC_",
  schema: z.object({
    api_url: z.string().default("http://localhost:4000/graphql"),
    tambo_api_key: z.string(),
    tambo_url: z.string().default("http://localhost:8261"),
  }),
});
