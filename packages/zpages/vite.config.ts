import { resolve } from "node:path";

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: {
        "adapter-hono": resolve(import.meta.dirname, "src/adapter-hono.ts"),
        "adapter-next": resolve(import.meta.dirname, "src/adapter-next.ts"),
        index: resolve(import.meta.dirname, "src/index.ts"),
      },
      formats: ["es"],
    },
    outDir: "dist",
    rollupOptions: {
      external: [/^node:/, "hono", "next/server"],
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      include: ["src"],
    }),
  ],
});
