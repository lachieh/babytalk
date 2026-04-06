import { babies, events, households, users } from "@babytalk/db";
import { and, desc, eq } from "drizzle-orm";

import type { Context } from "../context";
import { builder } from "./builder";
import { BabyEventType, BabyType, HouseholdType } from "./household-types";
import { UserType } from "./types";

const getHouseholdId = async (ctx: Context): Promise<string | null> => {
  if (!ctx.currentUser) return null;
  const [user] = await ctx.db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, ctx.currentUser.sub))
    .limit(1);
  return user?.householdId ?? null;
};

builder.queryField("myHousehold", (t) =>
  t.field({
    nullable: true,
    resolve: async (_root, _args, ctx) => {
      const householdId = await getHouseholdId(ctx);
      if (!householdId) return null;

      const [household] = await ctx.db
        .select()
        .from(households)
        .where(eq(households.id, householdId))
        .limit(1);

      return household ?? null;
    },
    type: HouseholdType,
  })
);

builder.queryField("householdMembers", (t) =>
  t.field({
    resolve: async (_root, _args, ctx) => {
      const householdId = await getHouseholdId(ctx);
      if (!householdId) return [];

      return ctx.db
        .select()
        .from(users)
        .where(eq(users.householdId, householdId));
    },
    type: [UserType],
  })
);

builder.queryField("myBabies", (t) =>
  t.field({
    resolve: async (_root, _args, ctx) => {
      const householdId = await getHouseholdId(ctx);
      if (!householdId) return [];

      return ctx.db
        .select()
        .from(babies)
        .where(eq(babies.householdId, householdId));
    },
    type: [BabyType],
  })
);

builder.queryField("recentEvents", (t) =>
  t.field({
    args: {
      babyId: t.arg.string({ required: true }),
      limit: t.arg.int({ required: false }),
      type: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const householdId = await getHouseholdId(ctx);
      if (!householdId) return [];

      // Verify baby belongs to household
      const [baby] = await ctx.db
        .select({ id: babies.id })
        .from(babies)
        .where(
          and(eq(babies.id, args.babyId), eq(babies.householdId, householdId))
        )
        .limit(1);
      if (!baby) return [];

      const conditions = [eq(events.babyId, args.babyId)];
      if (args.type) {
        conditions.push(eq(events.type, args.type));
      }

      return ctx.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.startedAt))
        .limit(args.limit ?? 20);
    },
    type: [BabyEventType],
  })
);

builder.queryField("lastEvent", (t) =>
  t.field({
    args: {
      babyId: t.arg.string({ required: true }),
      type: t.arg.string({ required: false }),
    },
    nullable: true,
    resolve: async (_root, args, ctx) => {
      const householdId = await getHouseholdId(ctx);
      if (!householdId) return null;

      // Verify baby belongs to household
      const [baby] = await ctx.db
        .select({ id: babies.id })
        .from(babies)
        .where(
          and(eq(babies.id, args.babyId), eq(babies.householdId, householdId))
        )
        .limit(1);
      if (!baby) return null;

      const conditions = [eq(events.babyId, args.babyId)];
      if (args.type) {
        conditions.push(eq(events.type, args.type));
      }

      const [event] = await ctx.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.startedAt))
        .limit(1);

      return event ?? null;
    },
    type: BabyEventType,
  })
);
