import { defineConfig } from "@babytalk/standard-config";
import { z } from "zod";

const base = {
  api_url: z
    .string()
    .default("http://localhost:4000/graphql")
    .describe("BabyTalk GraphQL API URL"),
  port: z.number().default(8262).describe("HTTP server port"),
};

const variants = z.discriminatedUnion("mode", [
  z.object({
    ...base,
    mode: z.literal("stdio").describe("Transport mode"),
    token: z.string().describe("JWT token (required for stdio mode)"),
  }),
  z.object({
    ...base,
    mode: z.literal("http").describe("Transport mode"),
    token: z.string().optional().describe("JWT token (optional for HTTP mode)"),
  }),
]);

export default defineConfig({
  prefix: "babytalk_mcp",
  schema: z.preprocess(
    (val) =>
      typeof val === "object" && val !== null && !("mode" in val)
        ? { ...val, mode: "stdio" }
        : val,
    variants
  ),
});
