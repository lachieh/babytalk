import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

import type { GenerateResult } from "../generator/core";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface LoaderContext {
  async: () => (err: Error | null, result?: string) => void;
  resourcePath: string;
  rootContext?: string;
}

/**
 * Webpack/Turbopack loader that triggers standard-config code generation
 * when a config source file is processed.
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

  const run = async (): Promise<string> => {
    const jiti = createJiti(dirname(resourcePath), { interopDefault: true });

    const mod = (await jiti.import(resourcePath)) as {
      default?: { schema?: unknown };
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
