export interface EnvOptions {
  /** Env var prefix, e.g. "APP" */
  prefix: string;
  /** Word separator in env var names. Default: "_" */
  separator?: string;
  /** Nesting separator in env var names. Default: "__" (double underscore) */
  nestingSeparator?: string;
  /** Key paths marked as public, e.g. ["api_url"] */
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
 * Dots in key paths become the nesting separator.
 * e.g. ("APP", "database.port", "_", "__") => "APP__DATABASE__PORT"
 * e.g. ("APP", "api_url", "_", "__") => "APP_API_URL"
 */
const keyToEnvName = (
  prefix: string,
  keyPath: string,
  separator: string,
  nestingSeparator: string
): string =>
  `${prefix}${nestingSeparator}${keyPath.replaceAll(".", nestingSeparator)}`.toUpperCase();

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

interface MatchResult {
  keyPath: string;
  isPublic: boolean;
}

/**
 * Try to match an env var key against known prefix patterns.
 * Returns the extracted key path and whether it's a public var.
 */
const matchEnvKey = (
  envKey: string,
  prefixUpper: string,
  separator: string,
  nestingSeparator: string,
  publicPrefix: string,
  fullPrefix: string
): MatchResult | null => {
  const nestingRegex = new RegExp(escapeRegex(nestingSeparator), "g");

  // Check public + nesting prefix (e.g. NEXT_PUBLIC_APP__DATABASE__PORT)
  if (
    publicPrefix &&
    envKey.startsWith(publicPrefix.toUpperCase() + fullPrefix)
  ) {
    const remainder = envKey
      .slice(publicPrefix.length + fullPrefix.length)
      .toLowerCase();
    return { isPublic: true, keyPath: remainder.split(nestingRegex).join(".") };
  }

  // Check public + word prefix for flat keys (e.g. NEXT_PUBLIC_APP_API_URL)
  const publicWordPrefix = `${publicPrefix.toUpperCase()}${prefixUpper}${separator}`;
  if (
    publicPrefix &&
    nestingSeparator !== separator &&
    envKey.startsWith(publicWordPrefix) &&
    !envKey.slice(publicWordPrefix.length).includes(nestingSeparator)
  ) {
    return {
      isPublic: true,
      keyPath: envKey.slice(publicWordPrefix.length).toLowerCase(),
    };
  }

  // Check standard nesting prefix (e.g. APP__DATABASE__PORT)
  if (envKey.startsWith(fullPrefix)) {
    const remainder = envKey.slice(fullPrefix.length).toLowerCase();
    return {
      isPublic: false,
      keyPath: remainder.split(nestingRegex).join("."),
    };
  }

  // Check standard word prefix for flat keys (e.g. APP_API_URL)
  const wordPrefix = `${prefixUpper}${separator}`;
  if (
    nestingSeparator !== separator &&
    envKey.startsWith(wordPrefix) &&
    !envKey.slice(wordPrefix.length).includes(nestingSeparator)
  ) {
    return {
      isPublic: false,
      keyPath: envKey.slice(wordPrefix.length).toLowerCase(),
    };
  }

  return null;
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
  const nestingSeparator = options.nestingSeparator ?? "__";
  const prefixUpper = options.prefix.toUpperCase();
  const fullPrefix = `${prefixUpper}${nestingSeparator}`;

  const publicPaths = new Set(options.public);
  const publicPrefix = options.publicPrefix ?? "";

  const result: Record<string, unknown> = {};

  for (const [envKey, envValue] of Object.entries(env)) {
    if (envValue === undefined) {
      continue;
    }

    const match = matchEnvKey(
      envKey,
      prefixUpper,
      separator,
      nestingSeparator,
      publicPrefix,
      fullPrefix
    );
    if (!match) continue;

    const { keyPath, isPublic } = match;

    // For public-prefixed vars, verify the path is declared public
    if (isPublic && !publicPaths.has(keyPath)) {
      continue;
    }

    // Apply custom mapping if provided
    // The envMap callback maps key paths to custom env var names.
    // During scanning, we reverse-check: if envMap produces a custom name
    // for this keyPath, verify the current env key matches it. If not,
    // skip this entry (another env key will match the custom name).
    if (options.envMap) {
      const customName = options.envMap(keyPath);
      if (
        customName !== null &&
        customName !== undefined &&
        envKey !== customName
      ) {
        continue;
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
  const nestingSeparator = options.nestingSeparator ?? "__";
  const publicPaths = new Set(options.public);
  const publicPrefix = options.publicPrefix ?? "";
  const map: Record<string, string> = {};

  for (const keyPath of keyPaths) {
    const baseName = keyToEnvName(
      options.prefix,
      keyPath,
      separator,
      nestingSeparator
    );

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
