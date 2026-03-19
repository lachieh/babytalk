import { NextResponse } from "next/server";

import { getPublicConfig } from "../public.js";
import type { ConfigDefinition } from "../types.js";

export interface WellKnownConfigOptions {
  /** Cache-Control max-age in seconds. Default: 60 */
  maxAge?: number;
}

/**
 * Create a Next.js App Router GET handler for /.well-known/config.
 *
 * Returns only the public subset of the config as JSON.
 *
 * Usage in app/.well-known/config/route.ts:
 * ```ts
 * import { createConfigHandler } from "@babytalk/standard-config/well-known/next";
 * import configDef from "@/config";
 * export const GET = createConfigHandler(configDef);
 * ```
 */
export const createConfigHandler = <T>(
  definition: ConfigDefinition<T>,
  options: WellKnownConfigOptions = {}
) => {
  const maxAge = options.maxAge ?? 60;

  return async (): Promise<NextResponse> => {
    const publicConfig = await getPublicConfig(definition);

    return NextResponse.json(publicConfig, {
      headers: {
        "cache-control": `public, max-age=${maxAge}`,
      },
    });
  };
};
