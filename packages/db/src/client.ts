import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema/index";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const initDb = (connectionString: string) => {
  _db = drizzle(connectionString, { schema });
  return _db;
};

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    if (!_db) {
      throw new Error(
        "Database not initialized. Call initDb(connectionString) before accessing db."
      );
    }
    return Reflect.get(_db, prop);
  },
});

export type Database = ReturnType<typeof drizzle<typeof schema>>;
