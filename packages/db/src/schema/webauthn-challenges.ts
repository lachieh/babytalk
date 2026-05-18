import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const webauthnChallenges = pgTable("webauthn_challenges", {
  challenge: text("challenge").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  email: text("email"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  userId: uuid("user_id"),
});
