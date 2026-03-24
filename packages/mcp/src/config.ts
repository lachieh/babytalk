import { defineConfig } from "@babytalk/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "babytalk_mcp",
  schema: z.object({
    api_url: z
      .string()
      .default("http://localhost:4000/graphql")
      .describe("BabyTalk GraphQL API URL"),
    port: z.number().default(8262).describe("HTTP server port"),
    token: z
      .string()
      .optional()
      .describe("Pre-set JWT token for stdio mode (optional)"),
  }),
});
