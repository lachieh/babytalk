import { resolve } from "node:path";

import { defineAppConfig } from "@babytalk/vite-config";

export default defineAppConfig({
  entry: resolve(import.meta.dirname, "src/index.ts"),
});
