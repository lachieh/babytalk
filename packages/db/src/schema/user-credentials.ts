import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const userCredentials = pgTable("user_credentials", {
  backedUp: boolean("backed_up").notNull().default(false),
  counter: integer("counter").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  credentialId: text("credential_id").notNull().unique(),
  deviceType: text("device_type").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  nickname: text("nickname"),
  publicKey: text("public_key").notNull(),
  transports: text("transports"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});
