import { resolve } from "node:path";

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: {
        cli: resolve(import.meta.dirname, "src/cli.ts"),
        client: resolve(import.meta.dirname, "src/client.ts"),
        index: resolve(import.meta.dirname, "src/index.ts"),
        unplugin: resolve(import.meta.dirname, "src/unplugin.ts"),
        "well-known/next": resolve(
          import.meta.dirname,
          "src/well-known/next.ts"
        ),
      },
      formats: ["es"],
    },
    outDir: "dist",
    rollupOptions: {
      external: [
        /^node:/,
        "@standard-schema/spec",
        "defu",
        "jiti",
        "next/server",
        "unplugin",
        "yaml",
      ],
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      include: ["src"],
    }),
  ],
});
