import { defineConfig } from "@bubsie/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "bubsie_web",
  public: ["apiUrl", "sourceUrl", "tamboUrl", "tamboApiKey"],
  schema: z.object({
    apiUrl: z.url().describe("Public URL of the GraphQL API"),
    sourceUrl: z
      .url()
      .optional()
      .describe("Source code link shown on the homepage (hidden if unset)"),
    tamboApiKey: z.string().default(""),
    tamboUrl: z.url().describe("Tambo API URL"),
  }),
});
