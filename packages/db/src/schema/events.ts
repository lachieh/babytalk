import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { babies } from "./babies";
import { users } from "./users";

export const events = pgTable("events", {
  babyId: uuid("baby_id")
    .notNull()
    .references(() => babies.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  id: uuid("id").primaryKey().defaultRandom(),
  loggedById: uuid("logged_by_id")
    .notNull()
    .references(() => users.id),
  metadata: jsonb("metadata").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  type: text("type").notNull(),
});
