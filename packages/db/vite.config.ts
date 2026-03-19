import { resolve } from "node:path";

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        "schema/index": resolve(import.meta.dirname, "src/schema/index.ts"),
      },
      formats: ["es"],
    },
    outDir: "dist",
    rollupOptions: {
      external: [/^node:/, /^drizzle-orm/, "postgres"],
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      include: ["src"],
    }),
  ],
});
