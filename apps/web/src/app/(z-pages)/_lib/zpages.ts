import { ZPages } from "@babytalk/zpages";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql";
const API_BASE = API_URL.replace(/\/graphql$/, "");

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
