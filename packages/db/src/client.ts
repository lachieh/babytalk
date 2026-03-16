import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const db = drizzle(connectionString, { schema });
export type Database = typeof db;
