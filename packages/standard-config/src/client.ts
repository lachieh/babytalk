let cached: Record<string, unknown> | null = null;
let pending: Promise<Record<string, unknown>> | null = null;

const doFetch = async (url: string): Promise<Record<string, unknown>> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch public config from ${url}: ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  cached = data;
  pending = null;
  return data;
};

/**
 * Fetch public config from /.well-known/config.
 * Caches the result for the lifetime of the page.
 * Deduplicates concurrent requests.
 *
 * Usage:
 * ```ts
 * import { fetchPublicConfig } from "@babytalk/standard-config/client";
 * const config = await fetchPublicConfig<{ api_url: string }>();
 * ```
 */
export const fetchPublicConfig = async <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  url = "/.well-known/config"
): Promise<T> => {
  if (cached) {
    return cached as T;
  }

  if (!pending) {
    pending = doFetch(url);
  }

  return (await pending) as T;
};

/**
 * Reset the cached config. Useful for testing.
 */
export const resetPublicConfigCache = (): void => {
  cached = null;
  pending = null;
};
