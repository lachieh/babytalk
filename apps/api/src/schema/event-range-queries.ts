import { babies, events, users } from "@babytalk/db";
import { and, asc, eq, gt, gte, inArray, isNull, lt, or } from "drizzle-orm";

import type { Context } from "../context";
import { builder } from "./builder";
import { BabyEventType } from "./household-types";

const DURATION_EVENT_TYPES = ["feed", "pump", "sleep"];

const getHouseholdId = async (ctx: Context): Promise<string | null> => {
  if (!ctx.currentUser) return null;
  const [user] = await ctx.db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, ctx.currentUser.sub))
    .limit(1);
  return user?.householdId ?? null;
};

builder.queryField("eventsOverlappingRange", (t) =>
  t.field({
    args: {
      babyId: t.arg.string({ required: true }),
      // ISO-8601 timestamps. Inclusive lower bound, exclusive upper bound.
      rangeEnd: t.arg.string({ required: true }),
      rangeStart: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const householdId = await getHouseholdId(ctx);
      if (!householdId) return [];

      const [baby] = await ctx.db
        .select({ id: babies.id })
        .from(babies)
        .where(
          and(eq(babies.id, args.babyId), eq(babies.householdId, householdId))
        )
        .limit(1);
      if (!baby) return [];

      const rangeStart = new Date(args.rangeStart);
      const rangeEnd = new Date(args.rangeEnd);
      if (
        Number.isNaN(rangeStart.getTime()) ||
        Number.isNaN(rangeEnd.getTime()) ||
        rangeEnd <= rangeStart
      ) {
        return [];
      }

      const startsInRange = and(
        gte(events.startedAt, rangeStart),
        lt(events.startedAt, rangeEnd)
      );
      const durationOverlapsRange = and(
        inArray(events.type, DURATION_EVENT_TYPES),
        lt(events.startedAt, rangeEnd),
        or(isNull(events.endedAt), gt(events.endedAt, rangeStart))
      );

      return ctx.db
        .select()
        .from(events)
        .where(
          and(
            eq(events.babyId, args.babyId),
            or(startsInRange, durationOverlapsRange)
          )
        )
        .orderBy(asc(events.startedAt));
    },
    type: [BabyEventType],
  })
);
