import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const magicLinks = pgTable("magic_links", {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});
