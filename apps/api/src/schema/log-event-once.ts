import { events } from "@bubsie/db";
import type { Database } from "@bubsie/db";
import { and, eq, isNull, sql } from "drizzle-orm";

export type NewEvent = typeof events.$inferInsert & {
  babyId: string;
  loggedById: string;
  startedAt: Date;
  type: string;
};

export type StoredEvent = typeof events.$inferSelect;

/**
 * Store an event, or return the one an earlier copy of the same request
 * already stored.
 *
 * A client that loses the response to `logEvent` (dropped connection, page
 * closed, service worker replay) resends the request unchanged. Without a
 * client id column to key on, the request itself is the key: the same person
 * logging the same baby, type, exact start, end and details. A transaction
 * advisory lock on that key makes two concurrent copies take turns, so the
 * second always sees the first.
 */
export const logEventOnce = (
  db: Database,
  values: NewEvent
): Promise<StoredEvent> =>
  db.transaction(async (tx) => {
    const key = [
      values.babyId,
      values.loggedById,
      values.type,
      values.startedAt.toISOString(),
    ].join("|");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`
    );

    const [existing] = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.babyId, values.babyId),
          eq(events.loggedById, values.loggedById),
          eq(events.type, values.type),
          eq(events.startedAt, values.startedAt),
          values.endedAt
            ? eq(events.endedAt, values.endedAt)
            : isNull(events.endedAt),
          sql`${events.metadata} = ${JSON.stringify(values.metadata ?? {})}::jsonb`
        )
      )
      .limit(1);
    if (existing) return existing;

    const [created] = await tx.insert(events).values(values).returning();
    return created;
  });
