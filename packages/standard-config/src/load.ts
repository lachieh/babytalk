import { defu } from "defu";

import { discoverConfigFiles } from "./loader/discover";
import { scanEnvVars } from "./loader/env";
import { mergeConfigFiles } from "./loader/merge";
import { validateConfig } from "./loader/validate";
import type { ConfigDefinition } from "./types";

/**
 * Collect all leaf key paths from a nested object as dot-separated strings.
 */
const collectKeys = (obj: Record<string, unknown>, prefix = ""): string[] => {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...collectKeys(value as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
};

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
  configDefinition: ConfigDefinition<T>
): Promise<Readonly<T>> => {
  const filePaths = discoverConfigFiles({
    prefix: configDefinition.prefix,
    root: configDefinition.root ?? process.cwd(),
  });

  const { config: fileConfig, sources } = mergeConfigFiles(filePaths);

  const envConfig = scanEnvVars({
    envMap: configDefinition.envMap,
    nestingSeparator: configDefinition.nestingSeparator,
    prefix: configDefinition.prefix,
    public: configDefinition.public,
    publicPrefix: configDefinition.publicPrefix,
    separator: configDefinition.separator,
  });

  // Env vars override file config — mark their keys as sourced from "env"
  for (const key of collectKeys(envConfig)) {
    sources.set(key, "env");
  }

  const merged = defu(envConfig, fileConfig);
  const validated = await validateConfig(
    configDefinition.schema,
    merged,
    sources
  );

  return Object.freeze(validated);
};
