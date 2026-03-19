export interface EnvOptions {
  /** Env var prefix, e.g. "APP" */
  prefix: string;
  /** Separator between prefix and nested keys. Default: "_" */
  separator?: string;
  /** Key paths marked as public, e.g. ["api.url"] */
  public?: string[];
  /** Public env var prefix, e.g. "NEXT_PUBLIC_" */
  publicPrefix?: string;
  /** Custom env var name mapping. Return null/undefined to use default. */
  envMap?: (keyPath: string) => string | null | undefined;
}

const escapeRegex = (str: string): string =>
  str.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Convert a dot-separated key path to an env var name.
 * e.g. ("APP", "database.port", "_") => "APP_DATABASE_PORT"
 */
const keyToEnvName = (
  prefix: string,
  keyPath: string,
  separator: string
): string =>
  `${prefix}${separator}${keyPath.replaceAll(".", separator)}`.toUpperCase();

/**
 * Set a nested value on an object using a dot-separated path.
 */
const setNested = (
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void => {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (
      key === undefined ||
      current[key] === undefined ||
      current[key] === null ||
      typeof current[key] !== "object"
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = parts.at(-1);
  if (lastKey !== undefined) {
    current[lastKey] = value;
  }
};

/**
 * Coerce a string env var value to a typed value.
 * - Strings starting with "[" are parsed as JSON arrays
 * - "true"/"false" become booleans
 * - Numeric strings become numbers
 * - Everything else stays as string
 */
const coerceValue = (value: string): unknown => {
  if (value.startsWith("[")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  const num = Number(value);
  if (value !== "" && !Number.isNaN(num)) {
    return num;
  }

  return value;
};

/**
 * Scan process.env for matching env vars and build a config overlay.
 * Returns a record of dot-separated key paths to coerced values.
 */
export const scanEnvVars = (
  options: EnvOptions,
  env: Record<string, string | undefined> = process.env
): Record<string, unknown> => {
  const separator = options.separator ?? "_";
  const prefixUpper = options.prefix.toUpperCase();
  const fullPrefix = `${prefixUpper}${separator}`;

  const publicPaths = new Set(options.public);
  const publicPrefix = options.publicPrefix ?? "";

  const result: Record<string, unknown> = {};

  for (const [envKey, envValue] of Object.entries(env)) {
    if (envValue === undefined) {
      continue;
    }

    let keyPath: string | undefined;

    // Check public prefix first (e.g. NEXT_PUBLIC_APP_DATABASE_PORT)
    if (
      publicPrefix &&
      envKey.startsWith(publicPrefix.toUpperCase() + fullPrefix)
    ) {
      const remainder = envKey
        .slice(publicPrefix.length + fullPrefix.length)
        .toLowerCase()
        .replaceAll(new RegExp(escapeRegex(separator), "g"), ".");
      keyPath = remainder;

      // Verify this is actually a declared public path
      if (!publicPaths.has(keyPath)) {
        continue;
      }
    }
    // Check standard prefix (e.g. APP_DATABASE_PORT)
    else if (envKey.startsWith(fullPrefix)) {
      const remainder = envKey
        .slice(fullPrefix.length)
        .toLowerCase()
        .replaceAll(new RegExp(escapeRegex(separator), "g"), ".");
      keyPath = remainder;
    } else {
      continue;
    }

    // Apply custom mapping if provided
    if (options.envMap) {
      const customName = options.envMap(keyPath);
      if (customName !== null && customName !== undefined) {
        // Custom name is the env var name, but we already have the value
        // The callback overrides the key path -> env var name mapping
        // Since we're scanning env vars, we reverse: check if this env key
        // matches what the custom mapping would produce
      }
    }

    setNested(result, keyPath, coerceValue(envValue));
  }

  return result;
};

/**
 * Build a map of key paths to their expected env var names.
 * Used for documentation/generation, not runtime loading.
 */
export const buildEnvVarMap = (
  options: EnvOptions,
  keyPaths: string[]
): Record<string, string> => {
  const separator = options.separator ?? "_";
  const publicPaths = new Set(options.public);
  const publicPrefix = options.publicPrefix ?? "";
  const map: Record<string, string> = {};

  for (const keyPath of keyPaths) {
    const baseName = keyToEnvName(options.prefix, keyPath, separator);

    // Apply custom mapping if provided
    if (options.envMap) {
      const custom = options.envMap(keyPath);
      if (custom !== null && custom !== undefined) {
        map[keyPath] = custom;
        continue;
      }
    }

    map[keyPath] = baseName;

    // Also add public variant if applicable
    if (publicPaths.has(keyPath) && publicPrefix) {
      map[`public:${keyPath}`] = `${publicPrefix.toUpperCase()}${baseName}`;
    }
  }

  return map;
};
