import type { NextConfig } from "next/dist/types";

import { getPublicConfig } from "./public";
import type { ConfigDefinition } from "./types";

/**
 * Flatten a nested config object into NEXT_PUBLIC_PREFIX_KEY env var entries.
 */
const flatten = (
  obj: Record<string, unknown>,
  prefix: string,
  separator: string,
  path: string[] = []
): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = [...path, key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(
        result,
        flatten(
          value as Record<string, unknown>,
          prefix,
          separator,
          currentPath
        )
      );
    } else {
      const envName =
        `NEXT_PUBLIC_${prefix}${separator}${currentPath.join(separator)}`.toUpperCase();
      result[envName] = String(value);
    }
  }

  return result;
};

/**
 * Load config and return public values as NEXT_PUBLIC_* env var entries.
 *
 * @example
 * ```ts
 * const env = await getNextPublicEnv(configDef);
 * // { NEXT_PUBLIC_BABYTALK_WEB_API_URL: "http://localhost:4000/graphql", ... }
 * ```
 */
export const getNextPublicEnv = async <T>(
  configDefinition: ConfigDefinition<T>
): Promise<Record<string, string>> => {
  const publicConfig = await getPublicConfig(configDefinition);
  const separator = configDefinition.separator ?? "_";
  const prefix = configDefinition.prefix.toUpperCase();

  return flatten(
    publicConfig as unknown as Record<string, unknown>,
    prefix,
    separator
  );
};

/**
 * Wrap a Next.js config to inject public standard-config values as
 * NEXT_PUBLIC_* environment variables at build time.
 *
 * @example
 * ```ts
 * // next.config.ts
 * import { withStandardConfig } from "@babytalk/standard-config/next";
 * import configDef from "./src/config";
 *
 * export default withStandardConfig(configDef, {
 *   output: "standalone",
 * });
 * ```
 */
export const withStandardConfig = async <T>(
  configDefinition: ConfigDefinition<T>,
  nextConfig: NextConfig = {}
): Promise<NextConfig> => {
  const publicEnv = await getNextPublicEnv(configDefinition);

  return {
    ...nextConfig,
    env: {
      ...(nextConfig.env as Record<string, string> | undefined),
      ...publicEnv,
    },
  };
};
