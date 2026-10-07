import { ZPages } from "@bubsie/zpages";

import { getConfig } from "@/lib/env";

export const zpages = new ZPages().addReadinessCheck("api", async () => {
  const start = Date.now();
  try {
    // Loaded per check rather than at import time so `next build` doesn't
    // need runtime config.
    const { apiUrl } = await getConfig();
    const res = await fetch(`${apiUrl.replace(/\/graphql$/, "")}/livez`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return {
        message: `API returned ${res.status}`,
        responseTime: Date.now() - start,
        status: "error",
      };
    }
    return { responseTime: Date.now() - start, status: "ok" };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "unknown error",
      responseTime: null,
      status: "error",
    };
  }
});
