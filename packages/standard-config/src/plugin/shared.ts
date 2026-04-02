import { resolve } from "node:path";

import { createUnplugin } from "unplugin";

import { generate } from "../generator/core";
import type { GenerateOptions } from "../generator/core";
import { discoverConfigFiles } from "../loader/discover";
import { loadDefinition } from "./load-definition";

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

export const unplugin = createUnplugin((options: PluginOptions = {}) => {
  const root = resolve(options.root ?? process.cwd());
  const schemaPath = resolve(root, options.schema ?? "./src/config.ts");

  /** Resolved config file paths being watched */
  let watchedConfigFiles: string[] = [];

  /**
   * Discover config files using the prefix from the schema definition
   * and add them to the watcher.
   */
  const discoverAndWatch = async (
    addWatchFile?: (path: string) => void
  ): Promise<void> => {
    try {
      const definition = await loadDefinition(schemaPath, root);
      if (!definition?.prefix) return;

      watchedConfigFiles = discoverConfigFiles({
        prefix: definition.prefix,
        root,
      });

      if (addWatchFile) {
        for (const file of watchedConfigFiles) {
          addWatchFile(file);
        }
      }
    } catch {
      // Schema not loadable yet (e.g. first build) — skip
    }
  };

  return {
    async buildStart() {
      await generate(toGenerateOptions(options));
      await discoverAndWatch(this.addWatchFile?.bind(this));
    },

    name: "standard-config",

    vite: {
      async configureServer(server) {
        // Generate types on dev server startup
        await generate(toGenerateOptions(options));
        await discoverAndWatch();

        // Add config files to Vite's file watcher
        for (const file of watchedConfigFiles) {
          server.watcher.add(file);
        }

        server.watcher.on("change", async (file) => {
          const resolved = resolve(file);

          if (resolved === schemaPath) {
            await generate(toGenerateOptions(options));
            // Re-discover in case prefix changed
            await discoverAndWatch();
            for (const f of watchedConfigFiles) {
              server.watcher.add(f);
            }
            return;
          }

          if (watchedConfigFiles.includes(resolved)) {
            server.config.logger.info(`Config file changed: ${resolved}`, {
              timestamp: true,
            });
            // Regenerate types so generated files reflect new config
            await generate(toGenerateOptions(options));
            // Invalidate SSR modules so the server re-evaluates config
            const envModule =
              server.environments.ssr?.moduleGraph.getModulesByFile(
                resolve(root, options.schema ?? "./src/config.ts")
              );
            if (envModule) {
              for (const mod of envModule) {
                server.environments.ssr?.moduleGraph.invalidateModule(mod);
              }
            }
            // Trigger a full reload since config affects the entire app
            server.environments.ssr?.hot.send({ type: "full-reload" });
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

      // Add config files to webpack's watched paths
      compiler.hooks.afterCompile.tap(
        "standard-config",
        (compilation: { fileDependencies: Set<string> }) => {
          for (const file of watchedConfigFiles) {
            compilation.fileDependencies.add(file);
          }
        }
      );
    },
  };
});
