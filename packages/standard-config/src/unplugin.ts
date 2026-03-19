import { resolve } from "node:path";

import { createUnplugin } from "unplugin";

import { generate } from "./generator/core.js";
import type { GenerateOptions } from "./generator/core.js";

export interface PluginOptions {
  /** Path to the schema source file. Default: "./src/config.ts" */
  schema?: string;
  /** Output path for .gen.ts. Default: "./src/config.gen.ts" */
  outputTs?: string;
  /** Output path for .schema.json. Default: "./src/config.schema.json" */
  outputJson?: string;
  /** Root directory. Default: process.cwd() */
  root?: string;
}

const toGenerateOptions = (options: PluginOptions): GenerateOptions => ({
  outputJson: options.outputJson,
  outputTs: options.outputTs,
  root: options.root,
  schema: options.schema,
});

const unplugin = createUnplugin((options: PluginOptions = {}) => {
  const root = resolve(options.root ?? process.cwd());
  const schemaPath = resolve(root, options.schema ?? "./src/config.ts");

  return {
    async buildStart() {
      await generate(toGenerateOptions(options));
    },

    name: "standard-config",

    vite: {
      configureServer(server) {
        server.watcher.on("change", async (file) => {
          if (resolve(file) === schemaPath) {
            await generate(toGenerateOptions(options));
          }
        });
      },
    },

    watchChange(id) {
      if (resolve(id) === schemaPath) {
        generate(toGenerateOptions(options));
      }
    },

    webpack(compiler) {
      compiler.hooks.watchRun.tapPromise("standard-config", async () => {
        await generate(toGenerateOptions(options));
      });
    },
  };
});

export const { vite } = unplugin;
export const { webpack } = unplugin;
export const { rollup } = unplugin;
export const { esbuild } = unplugin;

export default unplugin;
