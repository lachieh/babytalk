import { defineConfig } from "@bubsie/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "bubsie_api",
  schema: z.object({
    databaseUrl: z.string().describe("PostgreSQL connection string"),
    jwtSecret: z.string().min(16).describe("Secret key for signing JWTs"),
    port: z.number().default(4000).describe("HTTP server port"),
    rpName: z
      .string()
      .default("Bubsie")
      .describe("Relying Party display name shown by passkey prompts"),
    smtpFrom: z
      .string()
      .min(1)
      .describe("Sender email address, e.g. noreply@example.com"),
    smtpHost: z.string().min(1).describe("SMTP server hostname"),
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
      .url()
      .describe(
        "Public URL of the web app, used for CORS, passkeys, and email links"
      ),
  }),
});
