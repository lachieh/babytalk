import { db } from "@bubsie/db";
import { ZPages } from "@bubsie/zpages";
import { sql } from "drizzle-orm";

export const zpages = new ZPages().addReadinessCheck("postgres", async () => {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { responseTime: Date.now() - start, status: "ok" };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "unknown error",
      responseTime: null,
      status: "error",
    };
  }
});
