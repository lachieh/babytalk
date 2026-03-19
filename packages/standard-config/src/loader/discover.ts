import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";

import { ConfigError } from "../errors.js";

export interface DiscoverOptions {
  prefix: string;
  root?: string;
}

interface CandidatePair {
  yaml: string;
  json: string;
}

function fileExists(path: string): boolean {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function buildCandidates(prefix: string, root: string): CandidatePair[] {
  const xdgHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");

  return [
    // 1. <prefix>.config.local.yaml / .json
    {
      json: resolve(root, `${prefix}.config.local.json`),
      yaml: resolve(root, `${prefix}.config.local.yaml`),
    },
    // 2. <prefix>.config.yaml / .json
    {
      json: resolve(root, `${prefix}.config.json`),
      yaml: resolve(root, `${prefix}.config.yaml`),
    },
    // 3. .config/<prefix>.local.yaml / .json
    {
      json: resolve(root, ".config", `${prefix}.local.json`),
      yaml: resolve(root, ".config", `${prefix}.local.yaml`),
    },
    // 4. .config/<prefix>.yaml / .json
    {
      json: resolve(root, ".config", `${prefix}.json`),
      yaml: resolve(root, ".config", `${prefix}.yaml`),
    },
    // 5. .config/<prefix>/config.local.yaml / .json
    {
      json: resolve(root, ".config", prefix, "config.local.json"),
      yaml: resolve(root, ".config", prefix, "config.local.yaml"),
    },
    // 6. .config/<prefix>/config.yaml / .json
    {
      json: resolve(root, ".config", prefix, "config.json"),
      yaml: resolve(root, ".config", prefix, "config.yaml"),
    },
    // 7. $XDG_CONFIG_HOME/<prefix>.yaml / .json
    {
      json: resolve(xdgHome, `${prefix}.json`),
      yaml: resolve(xdgHome, `${prefix}.yaml`),
    },
    // 8. $XDG_CONFIG_HOME/<prefix>/config.yaml / .json
    {
      json: resolve(xdgHome, prefix, "config.json"),
      yaml: resolve(xdgHome, prefix, "config.yaml"),
    },
    // 9. $HOME/.config/<prefix>.yaml / .json
    {
      json: resolve(homedir(), ".config", `${prefix}.json`),
      yaml: resolve(homedir(), ".config", `${prefix}.yaml`),
    },
    // 10. $HOME/.config/<prefix>/config.yaml / .json
    {
      json: resolve(homedir(), ".config", prefix, "config.json"),
      yaml: resolve(homedir(), ".config", prefix, "config.yaml"),
    },
  ];
}

/**
 * Discovers config files in precedence order (highest first).
 * Throws ConfigError if both .yaml and .json exist at the same path.
 * Returns the list of existing file paths, highest precedence first.
 */
export function discoverConfigFiles(options: DiscoverOptions): string[] {
  const root = resolve(options.root ?? process.cwd());
  const candidates = buildCandidates(options.prefix, root);
  const found: string[] = [];

  for (const pair of candidates) {
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

    if (yamlExists) {
      found.push(pair.yaml);
    } else if (jsonExists) {
      found.push(pair.json);
    }
  }

  return found;
}
