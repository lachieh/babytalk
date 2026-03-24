import { defineConfig } from "@babytalk/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "babytalk_web",
  public: ["api_url", "tambo_url"],
  schema: z.object({
    api_url: z.string().default("http://localhost:4000/graphql"),
    tambo_api_key: z.string().default(""),
    tambo_url: z.string().default("http://localhost:8261"),
  }),
});
