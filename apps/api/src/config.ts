import { defineConfig } from "@babytalk/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "api",
  schema: z.object({
    jwt_secret: z.string().default("dev-secret-change-me"),
    port: z.number().default(4000),
    smtp: z
      .object({
        from: z.string().default("noreply@babytalk.dev"),
        host: z.string().default("localhost"),
        port: z.number().default(1025),
      })
      .default({
        from: "noreply@babytalk.dev",
        host: "localhost",
        port: 1025,
      }),
    web_url: z.string().default("http://localhost:3000"),
  }),
});
