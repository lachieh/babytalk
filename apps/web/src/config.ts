import { defineConfig } from "@bubsie/standard-config";
import { z } from "zod";

export default defineConfig({
  prefix: "bubsie_web",
  public: ["apiUrl", "sourceUrl"],
  schema: z.object({
    apiUrl: z.url().describe("Public URL of the GraphQL API"),
    sourceUrl: z
      .url()
      .optional()
      .describe("Source code link shown on the homepage (hidden if unset)"),
  }),
});
