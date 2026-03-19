import { loadConfig } from "./load";
import type { ConfigDefinition } from "./types";

/**
 * Pick only the keys listed in `definition.public` from a config object.
 */
const pickPublic = <T extends Record<string, unknown>>(
  config: T,
  publicKeys: string[]
): Partial<T> => {
  const result: Record<string, unknown> = {};

  for (const keyPath of publicKeys) {
    const parts = keyPath.split(".");
    let source: unknown = config;
    let target: Record<string, unknown> = result;

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (part === undefined || source === undefined || source === null) {
        break;
      }

      if (i === parts.length - 1) {
        target[part] = (source as Record<string, unknown>)[part];
      } else {
        if (!(part in target)) {
          target[part] = {};
        }
        target = target[part] as Record<string, unknown>;
        source = (source as Record<string, unknown>)[part];
      }
    }
  }

  return result as Partial<T>;
};

/**
 * Load config and return only the public subset.
 * If no public keys are defined, returns an empty object.
 */
export const getPublicConfig = async <T>(
  definition: ConfigDefinition<T>
): Promise<Partial<T>> => {
  const publicKeys = definition.public;
  if (!publicKeys || publicKeys.length === 0) {
    return {} as Partial<T>;
  }

  const config = await loadConfig(definition);
  return pickPublic(
    config as unknown as Record<string, unknown>,
    publicKeys
  ) as Partial<T>;
};
