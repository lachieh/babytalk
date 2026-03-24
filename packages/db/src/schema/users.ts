import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { households } from "./households";

export const users = pgTable("users", {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  email: text("email").notNull().unique(),
  householdId: uuid("household_id").references(() => households.id),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
