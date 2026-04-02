import { readFileSync } from "node:fs";

import { createDefu } from "defu";
import { parse as parseYaml } from "yaml";

/**
 * Custom defu merger that replaces arrays instead of concatenating them.
 * Returns UNDEFINED to fall through to defu's default deep-merge for objects.
 */
const mergeConfig = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    // biome-ignore lint: defu merger requires direct assignment
    obj[key] = value;
    return true;
  }
});

const parseFile = (filePath: string): Record<string, unknown> => {
  const content = readFileSync(filePath, "utf8");

  if (filePath.endsWith(".json")) {
    return JSON.parse(content) as Record<string, unknown>;
  }

  return (parseYaml(content) as Record<string, unknown> | null) ?? {};
};

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

export interface MergeResult {
  config: Record<string, unknown>;
  /** Maps dot-separated key paths to their source file path (highest-precedence wins). */
  sources: Map<string, string>;
}

/**
 * Reads and deep-merges config files in precedence order.
 * Files are listed highest-precedence first. defu merges so that
 * the first argument (highest precedence) wins for each key.
 *
 * Also returns a provenance map of which file each key came from.
 */
export const mergeConfigFiles = (filePaths: string[]): MergeResult => {
  const sources = new Map<string, string>();

  if (filePaths.length === 0) {
    return { config: {}, sources };
  }

  const configs = filePaths.map(parseFile);

  // Build provenance: iterate lowest-precedence first so highest wins
  for (let i = filePaths.length - 1; i >= 0; i -= 1) {
    const filePath = filePaths[i];
    const parsed = configs[i];
    for (const key of collectKeys(parsed)) {
      sources.set(key, filePath);
    }
  }

  // defu(highest, ...lower) — first arg wins per key
  const config = mergeConfig(configs[0] ?? {}, ...configs.slice(1));

  return { config, sources };
};
