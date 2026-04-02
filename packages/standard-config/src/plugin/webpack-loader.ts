import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

import type { GenerateResult } from "../generator/core";
import type { ConfigDefinition } from "../types";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface LoaderContext {
  addDependency?: (path: string) => void;
  async: () => (err: Error | null, result?: string) => void;
  resourcePath: string;
  rootContext?: string;
}

/**
 * Webpack/Turbopack loader that triggers standard-config code generation
 * when a config source file is processed.
 *
 * Also discovers config YAML/JSON files and registers them as dependencies
 * so that changes to config files trigger a rebuild.
 *
 * Passes through the source unchanged — generation is a side effect.
 *
 * Usage in next.config.ts (Turbopack):
 *   turbopack: {
 *     rules: {
 *       'config.ts': {
 *         loaders: ['@babytalk/standard-config/loader'],
 *         as: '*.ts',
 *       },
 *     },
 *   },
 */
export default function standardConfigLoader(
  this: LoaderContext,
  source: string
) {
  const callback = this.async();
  const { resourcePath } = this;
  const root = this.rootContext ?? process.cwd();
  const addDependency = this.addDependency?.bind(this);

  const run = async (): Promise<string> => {
    const jiti = createJiti(dirname(resourcePath), { interopDefault: true });

    const mod = (await jiti.import(resourcePath)) as {
      default?: ConfigDefinition<unknown>;
    };
    if (!mod.default?.schema) {
      return source;
    }

    const { generate } = (await jiti.import(
      resolve(__dirname, "../generator/core")
    )) as {
      generate: (opts: {
        root: string;
        schema: string;
      }) => Promise<GenerateResult>;
    };

    const result = await generate({ root, schema: resourcePath });
    console.log(`[standard-config] Generated: ${result.tsPath}`);
    if (result.jsonPath) {
      console.log(`[standard-config] Generated: ${result.jsonPath}`);
    }

    // Register config files as dependencies so changes trigger a rebuild
    if (addDependency && mod.default.prefix) {
      const { discoverConfigFiles } = (await jiti.import(
        resolve(__dirname, "../loader/discover")
      )) as {
        discoverConfigFiles: (opts: {
          prefix: string;
          root?: string;
        }) => string[];
      };

      const configFiles = discoverConfigFiles({
        prefix: mod.default.prefix,
        root,
      });

      for (const file of configFiles) {
        addDependency(file);
      }
    }

    return source;
  };

  run().then(
    (result) => callback(null, result),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[standard-config] Generation failed: ${message}`);
      callback(null, source);
    }
  );
}
