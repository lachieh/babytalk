import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { babies } from "./babies";
import { users } from "./users";

export const measurements = pgTable("measurements", {
  babyId: uuid("baby_id")
    .notNull()
    .references(() => babies.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  headMm: integer("head_mm"),
  id: uuid("id").primaryKey().defaultRandom(),
  lengthMm: integer("length_mm"),
  loggedById: uuid("logged_by_id")
    .notNull()
    .references(() => users.id),
  measuredAt: timestamp("measured_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  notes: text("notes"),
  weightG: integer("weight_g"),
});
