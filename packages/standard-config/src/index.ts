import type { ConfigDefinition } from "./types";

export type { ConfigDefinition } from "./types";
export { ConfigError } from "./errors";
export type { ConfigIssue } from "./errors";
export { discoverConfigFiles } from "./loader/discover";
export { mergeConfigFiles } from "./loader/merge";
export { scanEnvVars, buildEnvVarMap } from "./loader/env";
export { validateConfig } from "./loader/validate";
export { loadConfig } from "./load";
export { getPublicConfig } from "./public";
export { generate } from "./generator/core";
export type { GenerateOptions, GenerateResult } from "./generator/core";

/**
 * Define a config shape. Returns the definition object (identity function
 * for type inference).
 *
 * @example
 * ```ts
 * import { defineConfig } from "@babytalk/standard-config";
 * import { z } from "zod";
 *
 * export default defineConfig({
 *   prefix: "app",
 *   schema: z.object({
 *     port: z.number().default(3000),
 *     database: z.object({ host: z.string(), port: z.number() }),
 *   }),
 *   public: ["port"],
 * });
 * ```
 */
export const defineConfig = <T>(
  definition: ConfigDefinition<T>
): ConfigDefinition<T> => definition;
