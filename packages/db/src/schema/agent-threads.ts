import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { babies } from "./babies";

export const agentThreads = pgTable(
  "agent_threads",
  {
    activityKey: text("activity_key").notNull(),
    babyId: uuid("baby_id")
      .notNull()
      .references(() => babies.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    state: jsonb("state").notNull().default({}),
    tamboLastRunId: text("tambo_last_run_id"),
    tamboThreadId: text("tambo_thread_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("agent_threads_baby_activity_idx").on(
      table.babyId,
      table.activityKey
    ),
  ]
);
