import { defineConfig } from "@babytalk/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "babytalk_api",
  schema: z.object({
    databaseUrl: z.string().describe("PostgreSQL connection string"),
    jwtSecret: z
      .string()
      .default("dev-secret-change-me")
      .describe("Secret key for signing JWTs"),
    port: z.number().default(4000).describe("HTTP server port"),
    smtp: z
      .object({
        from: z
          .string()
          .default("noreply@babytalk.dev")
          .describe("Sender email address"),
        host: z.string().default("localhost").describe("SMTP server hostname"),
        port: z.number().default(1025).describe("SMTP server port"),
      })
      .default({
        from: "noreply@babytalk.dev",
        host: "localhost",
        port: 1025,
      })
      .describe("SMTP mail configuration"),
    webUrl: z
      .string()
      .default("http://localhost:3000")
      .describe("Frontend URL for CORS and email links"),
  }),
});
