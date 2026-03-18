import { NextResponse } from "next/server";

const startTime = Date.now();

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql";
const API_BASE = API_URL.replace(/\/graphql$/, "");

async function checkApi(): Promise<{
  status: "ok" | "error";
  responseTime: number | null;
  message?: string;
}> {
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
}

export async function GET() {
  const api = await checkApi();
  const ok = api.status === "ok";

  return NextResponse.json(
    {
      checks: { api },
      status: ok ? "ok" : "error",
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - startTime) / 1000,
    },
    { status: ok ? 200 : 503 }
  );
}
