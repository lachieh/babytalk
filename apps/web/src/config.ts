import { defineConfig } from "@babytalk/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "app",
  schema: z.object({
    api_url: z.string().default("http://localhost:4000/graphql"),
  }),
});
