import type { StandardSchemaV1 } from "@standard-schema/spec";
import { defu } from "defu";

import { discoverConfigFiles } from "./loader/discover.js";
import { scanEnvVars } from "./loader/env.js";
import { mergeConfigFiles } from "./loader/merge.js";
import { validateConfig } from "./loader/validate.js";

export { ConfigError } from "./errors.js";
export type { ConfigIssue } from "./errors.js";
export { discoverConfigFiles } from "./loader/discover.js";
export { mergeConfigFiles } from "./loader/merge.js";
export { scanEnvVars, buildEnvVarMap } from "./loader/env.js";
export { validateConfig } from "./loader/validate.js";
export { generate } from "./generator/core.js";
export type { GenerateOptions, GenerateResult } from "./generator/core.js";

export interface ConfigDefinition<T> {
  /** Config file prefix, e.g. "app" => app.config.yaml */
  prefix: string;
  /** Schema for validation (any standard-schema@1.1 compatible) */
  schema: StandardSchemaV1<unknown, T>;
  /** Root directory for file discovery. Default: process.cwd() */
  root?: string;
  /** Env var separator. Default: "_" */
  separator?: string;
  /** Key paths exposed as public config */
  public?: string[];
  /** Public env var prefix, e.g. "NEXT_PUBLIC_" */
  publicPrefix?: string;
  /** Custom env var name mapping callback */
  envMap?: (keyPath: string) => string | null | undefined;
}

/**
 * Define a config shape. Returns the definition object (identity function
 * for type inference).
 */
export function defineConfig<T>(
  definition: ConfigDefinition<T>
): ConfigDefinition<T> {
  return definition;
}

/**
 * Load, merge, and validate config from files and environment variables.
 *
 * 1. Discover config files in precedence order
 * 2. Deep-merge files (highest precedence first)
 * 3. Scan env vars and overlay on merged config
 * 4. Validate against schema
 * 5. Return frozen config object
 */
export async function loadConfig<T>(
  definition: ConfigDefinition<T>
): Promise<Readonly<T>> {
  // 1. Discover files
  const filePaths = discoverConfigFiles({
    prefix: definition.prefix,
    root: definition.root,
  });

  // 2. Merge files
  const fileConfig = mergeConfigFiles(filePaths);

  // 3. Scan env vars
  const envConfig = scanEnvVars({
    envMap: definition.envMap,
    prefix: definition.prefix,
    public: definition.public,
    publicPrefix: definition.publicPrefix,
    separator: definition.separator,
  });

  // 4. Overlay: env wins over files (env is higher precedence)
  const merged = defu(envConfig, fileConfig);

  // 5. Validate
  const validated = await validateConfig(definition.schema, merged);

  // 6. Freeze and return
  return Object.freeze(validated);
}
