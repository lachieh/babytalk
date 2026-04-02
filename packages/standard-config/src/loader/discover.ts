import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { ConfigError } from "../errors";

export interface DiscoverOptions {
  prefix: string;
  root: string;
}

interface CandidatePair {
  yaml: string;
  json: string;
}

const fileExists = (path: string): boolean => {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Build local candidate pairs for a single directory.
 */
const buildLocalCandidates = (prefix: string, dir: string): CandidatePair[] => [
  {
    json: resolve(dir, `${prefix}.config.local.json`),
    yaml: resolve(dir, `${prefix}.config.local.yaml`),
  },
  {
    json: resolve(dir, `${prefix}.config.json`),
    yaml: resolve(dir, `${prefix}.config.yaml`),
  },
  {
    json: resolve(dir, ".config", `${prefix}.local.json`),
    yaml: resolve(dir, ".config", `${prefix}.local.yaml`),
  },
  {
    json: resolve(dir, ".config", `${prefix}.json`),
    yaml: resolve(dir, ".config", `${prefix}.yaml`),
  },
  {
    json: resolve(dir, ".config", prefix, "config.local.json"),
    yaml: resolve(dir, ".config", prefix, "config.local.yaml"),
  },
  {
    json: resolve(dir, ".config", prefix, "config.json"),
    yaml: resolve(dir, ".config", prefix, "config.yaml"),
  },
];

/**
 * Build global candidate pairs (XDG and home config).
 */
const buildGlobalCandidates = (prefix: string): CandidatePair[] => {
  const xdgHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");

  return [
    {
      json: resolve(xdgHome, `${prefix}.json`),
      yaml: resolve(xdgHome, `${prefix}.yaml`),
    },
    {
      json: resolve(xdgHome, prefix, "config.json"),
      yaml: resolve(xdgHome, prefix, "config.yaml"),
    },
    {
      json: resolve(homedir(), ".config", `${prefix}.json`),
      yaml: resolve(homedir(), ".config", `${prefix}.yaml`),
    },
    {
      json: resolve(homedir(), ".config", prefix, "config.json"),
      yaml: resolve(homedir(), ".config", prefix, "config.yaml"),
    },
  ];
};

/**
 * Walk from `start` up to the filesystem root, yielding each directory.
 * @yields Each ancestor directory, starting with `start` and ending with the root.
 */
function* ancestors(start: string): Generator<string> {
  let current = start;
  while (true) {
    yield current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

const checkPair = (
  pair: CandidatePair,
  found: string[],
  seen: Set<string>
): void => {
  const yamlExists = fileExists(pair.yaml);
  const jsonExists = fileExists(pair.json);

  if (yamlExists && jsonExists) {
    throw new ConfigError([
      {
        message: `Both YAML and JSON config files exist at the same path. Remove one: ${pair.yaml} / ${pair.json}`,
        path: pair.yaml,
      },
    ]);
  }
  const yaml = yamlExists ? pair.yaml : null;
  const json = jsonExists ? pair.json : null;
  const match = yaml ?? json;
  if (match && !seen.has(match)) {
    seen.add(match);
    found.push(match);
  }
};

/**
 * Discovers config files in precedence order (highest first).
 *
 * Local patterns are searched starting from `root` and walking
 * up ancestor directories until the home directory. This allows monorepo apps
 * to find config files at the repo root even when run from a subdirectory.
 *
 * Global patterns (XDG, home) are searched at fixed locations.
 *
 * Throws ConfigError if both .yaml and .json exist at the same path.
 * Returns the list of existing file paths, highest precedence first.
 */
export const discoverConfigFiles = (options: DiscoverOptions): string[] => {
  const root = resolve(options.root);
  const home = homedir();
  const found: string[] = [];
  const seen = new Set<string>();

  for (const dir of ancestors(root)) {
    for (const pair of buildLocalCandidates(options.prefix, dir)) {
      checkPair(pair, found, seen);
    }
    if (dir === home) break;
  }

  for (const pair of buildGlobalCandidates(options.prefix)) {
    checkPair(pair, found, seen);
  }

  return found;
};
