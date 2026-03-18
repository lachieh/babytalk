import type { IncomingMessage, ServerResponse } from "node:http";

import { db } from "@babytalk/db";
import { sql } from "drizzle-orm";

const startTime = Date.now();

function uptime(): number {
  return (Date.now() - startTime) / 1000;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function checkPostgres(): Promise<{
  status: "ok" | "error";
  responseTime: number | null;
  message?: string;
}> {
  const start = Date.now();
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3000)
      ),
    ]);
    return { responseTime: Date.now() - start, status: "ok" };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "unknown error",
      responseTime: null,
      status: "error",
    };
  }
}

async function handleLivez(res: ServerResponse): Promise<void> {
  json(res, 200, {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: uptime(),
  });
}

async function handleReadyz(res: ServerResponse): Promise<void> {
  const postgres = await checkPostgres();
  const ok = postgres.status === "ok";

  json(res, ok ? 200 : 503, {
    checks: { postgres },
    status: ok ? "ok" : "error",
    timestamp: new Date().toISOString(),
    uptime: uptime(),
  });
}

async function handleHealthz(res: ServerResponse): Promise<void> {
  const postgres = await checkPostgres();
  const ok = postgres.status === "ok";

  json(res, ok ? 200 : 503, {
    checks: { postgres },
    status: ok ? "ok" : "error",
    timestamp: new Date().toISOString(),
    uptime: uptime(),
  });
}

export function handleHealthRoutes(
  req: IncomingMessage,
  res: ServerResponse
): boolean {
  const url = req.url?.split("?")[0];

  if (url === "/livez") {
    handleLivez(res);
    return true;
  }
  if (url === "/readyz") {
    handleReadyz(res);
    return true;
  }
  if (url === "/healthz") {
    handleHealthz(res);
    return true;
  }

  return false;
}
