import { defineConfig } from "@bubsie/standard-config";
import { z } from "zod";

const base = {
  api_url: z.url().describe("Bubsie GraphQL API URL"),
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
  prefix: "bubsie_mcp",
  schema: z.preprocess(
    (val) =>
      typeof val === "object" && val !== null && !("mode" in val)
        ? { ...val, mode: "stdio" }
        : val,
    variants
  ),
});
