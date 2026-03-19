import { defineConfig } from "@babytalk/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "app",
  public: ["api_url"],
  publicPrefix: "NEXT_PUBLIC_",
  schema: z.object({
    api_url: z.string().default("http://localhost:4000/graphql"),
  }),
});
