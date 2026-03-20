import { defineConfig } from "@babytalk/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "web",
  public: ["api_url"],
  schema: z.object({
    api_url: z.string().default("http://localhost:4000/graphql"),
  }),
});
