import { resolve } from "node:path";

import { defineAppConfig } from "@bubsie/vite-config";

export default defineAppConfig({
  entry: resolve(import.meta.dirname, "src/index.ts"),
});
