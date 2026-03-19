import type { ConfigDefinition } from "./types.js";

export type { ConfigDefinition } from "./types.js";
export { ConfigError } from "./errors.js";
export type { ConfigIssue } from "./errors.js";
export { discoverConfigFiles } from "./loader/discover.js";
export { mergeConfigFiles } from "./loader/merge.js";
export { scanEnvVars, buildEnvVarMap } from "./loader/env.js";
export { validateConfig } from "./loader/validate.js";
export { loadConfig } from "./load.js";
export { getPublicConfig } from "./public.js";
export { generate } from "./generator/core.js";
export type { GenerateOptions, GenerateResult } from "./generator/core.js";

/**
 * Define a config shape. Returns the definition object (identity function
 * for type inference).
 */
export const defineConfig = <T>(
  definition: ConfigDefinition<T>
): ConfigDefinition<T> => definition;
