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

  return parseYaml(content) as Record<string, unknown>;
};

/**
 * Reads and deep-merges config files in precedence order.
 * Files are listed highest-precedence first. defu merges so that
 * the first argument (highest precedence) wins for each key.
 */
export const mergeConfigFiles = (
  filePaths: string[]
): Record<string, unknown> => {
  if (filePaths.length === 0) {
    return {};
  }

  const configs = filePaths.map(parseFile);

  // defu(highest, ...lower) — first arg wins per key
  return mergeConfig(configs[0] ?? {}, ...configs.slice(1));
};
