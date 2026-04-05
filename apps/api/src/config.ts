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
    smtpFrom: z
      .string()
      .default("noreply@babytalk.dev")
      .describe("Sender email address"),
    smtpHost: z.string().default("localhost").describe("SMTP server hostname"),
    smtpPass: z
      .string()
      .default("")
      .describe("SMTP password (Resend API key for smtp.resend.com)"),
    smtpPort: z.number().default(1025).describe("SMTP server port"),
    smtpUser: z
      .string()
      .default("")
      .describe("SMTP username ('resend' for smtp.resend.com)"),
    webUrl: z
      .string()
      .default("http://localhost:3000")
      .describe("Frontend URL for CORS and email links"),
  }),
});
