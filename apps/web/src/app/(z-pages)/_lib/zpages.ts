import { ZPages } from "@babytalk/zpages";

import { getApiUrl } from "@/lib/env";

const API_BASE = getApiUrl().replace(/\/graphql$/, "");

export const zpages = new ZPages().addReadinessCheck("api", async () => {
  const start = Date.now();
  try {
    const res = await fetch(`${API_BASE}/livez`, {
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
