import { db } from "@babytalk/db";
import { ZPages } from "@babytalk/zpages";
import { sql } from "drizzle-orm";

export const zpages = new ZPages().addReadinessCheck("postgres", async () => {
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
});
