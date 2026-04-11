import {
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { households } from "./households";

export const babies = pgTable("babies", {
  birthDate: date("birth_date").notNull(),
  birthWeightG: integer("birth_weight_g"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  gender: text("gender"),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});
