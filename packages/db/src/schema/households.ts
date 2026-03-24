import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const households = pgTable("households", {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  id: uuid("id").primaryKey().defaultRandom(),
  inviteCode: text("invite_code").notNull().unique(),
});
