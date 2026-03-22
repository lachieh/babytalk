import { defu } from "defu";

import { discoverConfigFiles } from "./loader/discover";
import { scanEnvVars } from "./loader/env";
import { mergeConfigFiles } from "./loader/merge";
import { validateConfig } from "./loader/validate";
import type { ConfigDefinition } from "./types";

/**
 * Load, merge, and validate config from files and environment variables.
 *
 * 1. Discover config files in precedence order
 * 2. Deep-merge files (highest precedence first)
 * 3. Scan env vars and overlay on merged config
 * 4. Validate against schema
 * 5. Return frozen config object
 *
 * @example
 * ```ts
 * import { loadConfig } from "@babytalk/standard-config";
 * import configDef from "./config";
 *
 * const config = await loadConfig(configDef);
 * console.log(config.database.host);
 * ```
 */
export const loadConfig = async <T>(
  definition: ConfigDefinition<T>
): Promise<Readonly<T>> => {
  const filePaths = discoverConfigFiles({
    prefix: definition.prefix,
    root: definition.root,
  });

  const fileConfig = mergeConfigFiles(filePaths);

  const envConfig = scanEnvVars({
    envMap: definition.envMap,
    prefix: definition.prefix,
    public: definition.public,
    publicPrefix: definition.publicPrefix,
    separator: definition.separator,
  });

  const merged = defu(envConfig, fileConfig);
  const validated = await validateConfig(definition.schema, merged);

  return Object.freeze(validated);
};
