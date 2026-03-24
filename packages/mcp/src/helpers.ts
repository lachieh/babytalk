import { babies, db, events, households, users } from "@babytalk/db";
import { and, desc, eq } from "drizzle-orm";

import type { AuthUser } from "./auth";

export const requireHousehold = async (
  user: AuthUser
): Promise<{ userId: string; householdId: string }> => {
  const [row] = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, user.sub))
    .limit(1);
  if (!row?.householdId) throw new Error("No household");
  return { householdId: row.householdId, userId: user.sub };
};

export const requireBabyAccess = async (
  babyId: string,
  householdId: string
): Promise<void> => {
  const [baby] = await db
    .select({ id: babies.id })
    .from(babies)
    .where(and(eq(babies.id, babyId), eq(babies.householdId, householdId)))
    .limit(1);
  if (!baby) throw new Error("Baby not found in household");
};

export type EventType = "feed" | "sleep" | "diaper" | "note";

export const buildMetadata = (
  type: string,
  meta: Record<string, unknown>
): Record<string, unknown> => {
  switch (type) {
    case "feed": {
      if (!meta.method) throw new Error("method required for feed events");
      return { ...meta };
    }
    case "sleep": {
      return { ...meta };
    }
    case "diaper": {
      if (meta.wet === undefined && meta.soiled === undefined) {
        throw new Error("wet or soiled required for diaper events");
      }
      return { ...meta };
    }
    case "note": {
      if (!meta.text) throw new Error("text required for note events");
      return { ...meta };
    }
    default: {
      throw new Error(`Unknown event type: ${type}`);
    }
  }
};

export const formatEvent = (event: {
  id: string;
  babyId: string;
  type: string;
  startedAt: Date;
  endedAt: Date | null;
  metadata: unknown;
  loggedById: string;
  createdAt: Date;
}) => ({
  babyId: event.babyId,
  endedAt: event.endedAt?.toISOString() ?? null,
  id: event.id,
  loggedById: event.loggedById,
  metadata: JSON.stringify(event.metadata),
  startedAt: event.startedAt.toISOString(),
  type: event.type,
});

export { babies, db, events, households, users, and, desc, eq };
