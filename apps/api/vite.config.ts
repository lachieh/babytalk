import { resolve } from "node:path";

import { vite as standardConfig } from "@babytalk/standard-config/vite";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      fileName: "index",
      formats: ["es"],
    },
    outDir: "dist",
    rollupOptions: {
      external: [
        /^node:/,
        /^@babytalk\//,
        /^@hono\//,
        /^@pothos\//,
        /^drizzle-orm/,
        "graphql",
        "graphql-yoga",
        "hono",
        "hono/cors",
        "jose",
        "nodemailer",
        "postgres",
        "zod",
      ],
    },
    sourcemap: true,
  },
  plugins: [
    standardConfig({
      schema: "./src/config.ts",
    }),
  ],
});
