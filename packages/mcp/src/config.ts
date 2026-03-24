import { defineConfig } from "@babytalk/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "babytalk_mcp",
  schema: z.object({
    database_url: z.string().describe("PostgreSQL connection string"),
    jwt_secret: z
      .string()
      .default("dev-secret-change-me")
      .describe("Secret key for verifying JWTs (must match API)"),
    port: z.number().default(8262).describe("HTTP server port"),
    token: z
      .string()
      .optional()
      .describe("Pre-set JWT token for stdio mode (optional)"),
  }),
});
