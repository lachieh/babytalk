import { NextResponse } from "next/server";

const startTime = Date.now();

export function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: (Date.now() - startTime) / 1000,
  });
}
