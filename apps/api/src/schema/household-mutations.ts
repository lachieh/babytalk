import { babies, events, households, users } from "@babytalk/db";
import { and, eq } from "drizzle-orm";

import { invitePartner } from "../auth/magic-link";
import type { Context } from "../context";
import { generateInviteCode } from "../utils/invite-code";
import { builder } from "./builder";
import {
  BabyEventType,
  BabyType,
  DiaperMetadataInput,
  EventTypeEnum,
  FeedMetadataInput,
  HouseholdType,
  NoteMetadataInput,
  PumpMetadataInput,
  SleepMetadataInput,
} from "./household-types";

const requireAuth = (ctx: Context): string => {
  if (!ctx.currentUser) throw new Error("Not authenticated");
  return ctx.currentUser.sub;
};

const requireHousehold = async (
  ctx: Context
): Promise<{ userId: string; householdId: string }> => {
  const userId = requireAuth(ctx);
  const [user] = await ctx.db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.householdId) throw new Error("No household");
  return { householdId: user.householdId, userId };
};

const requireBabyAccess = async (
  ctx: Context,
  babyId: string,
  householdId: string
): Promise<void> => {
  const [baby] = await ctx.db
    .select({ id: babies.id })
    .from(babies)
    .where(and(eq(babies.id, babyId), eq(babies.householdId, householdId)))
    .limit(1);
  if (!baby) throw new Error("Baby not found in household");
};

// --- Household ---

builder.mutationField("createHousehold", (t) =>
  t.field({
    resolve: async (_root, _args, ctx) => {
      const userId = requireAuth(ctx);

      const [existingUser] = await ctx.db
        .select({ householdId: users.householdId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (existingUser?.householdId) throw new Error("Already in a household");

      const [household] = await ctx.db
        .insert(households)
        .values({ inviteCode: generateInviteCode() })
        .returning();

      await ctx.db
        .update(users)
        .set({ householdId: household.id })
        .where(eq(users.id, userId));

      return household;
    },
    type: HouseholdType,
  })
);

builder.mutationField("joinHousehold", (t) =>
  t.field({
    args: {
      inviteCode: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const userId = requireAuth(ctx);

      const [existingUser] = await ctx.db
        .select({ householdId: users.householdId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (existingUser?.householdId) throw new Error("Already in a household");

      const [household] = await ctx.db
        .select()
        .from(households)
        .where(eq(households.inviteCode, args.inviteCode))
        .limit(1);
      if (!household) throw new Error("Invalid invite code");

      await ctx.db
        .update(users)
        .set({ householdId: household.id })
        .where(eq(users.id, userId));

      return household;
    },
    type: HouseholdType,
  })
);

builder.mutationField("invitePartner", (t) =>
  t.field({
    args: {
      email: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { householdId } = await requireHousehold(ctx);

      const [household] = await ctx.db
        .select({ inviteCode: households.inviteCode })
        .from(households)
        .where(eq(households.id, householdId))
        .limit(1);
      if (!household) throw new Error("Household not found");

      await invitePartner(args.email, household.inviteCode);
      return true;
    },
    type: "Boolean",
  })
);

// --- Baby ---

builder.mutationField("addBaby", (t) =>
  t.field({
    args: {
      birthDate: t.arg.string({ required: true }),
      birthWeightG: t.arg.int({ required: false }),
      name: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { householdId } = await requireHousehold(ctx);

      const [baby] = await ctx.db
        .insert(babies)
        .values({
          birthDate: args.birthDate,
          birthWeightG: args.birthWeightG ?? null,
          householdId,
          name: args.name,
        })
        .returning();

      return baby;
    },
    type: BabyType,
  })
);

// --- Events ---

const buildMetadata = (
  type: string,
  args: {
    diaperMeta?: {
      color?: string | null;
      notes?: string | null;
      soiled: boolean;
      wet: boolean;
    } | null;
    feedMeta?: {
      amountMl?: number | null;
      foodDesc?: string | null;
      method: string;
      side?: string | null;
    } | null;
    noteMeta?: { text: string } | null;
    pumpMeta?: {
      amountMl?: number | null;
      side: string;
    } | null;
    sleepMeta?: { location?: string | null; quality?: string | null } | null;
  }
): Record<string, unknown> => {
  switch (type) {
    case "feed": {
      if (!args.feedMeta) throw new Error("feedMeta required for feed events");
      return { ...args.feedMeta };
    }
    case "sleep": {
      return { ...args.sleepMeta };
    }
    case "diaper": {
      if (!args.diaperMeta)
        throw new Error("diaperMeta required for diaper events");
      return { ...args.diaperMeta };
    }
    case "note": {
      if (!args.noteMeta) throw new Error("noteMeta required for note events");
      return { ...args.noteMeta };
    }
    case "pump": {
      if (!args.pumpMeta) throw new Error("pumpMeta required for pump events");
      return { ...args.pumpMeta };
    }
    default: {
      throw new Error(`Unknown event type: ${type}`);
    }
  }
};

builder.mutationField("logEvent", (t) =>
  t.field({
    args: {
      babyId: t.arg.string({ required: true }),
      diaperMeta: t.arg({ required: false, type: DiaperMetadataInput }),
      endedAt: t.arg.string({ required: false }),
      feedMeta: t.arg({ required: false, type: FeedMetadataInput }),
      noteMeta: t.arg({ required: false, type: NoteMetadataInput }),
      pumpMeta: t.arg({ required: false, type: PumpMetadataInput }),
      sleepMeta: t.arg({ required: false, type: SleepMetadataInput }),
      startedAt: t.arg.string({ required: false }),
      type: t.arg({ required: true, type: EventTypeEnum }),
    },
    resolve: async (_root, args, ctx) => {
      const { householdId, userId } = await requireHousehold(ctx);
      await requireBabyAccess(ctx, args.babyId, householdId);

      const metadata = buildMetadata(args.type, args);

      const [event] = await ctx.db
        .insert(events)
        .values({
          babyId: args.babyId,
          endedAt: args.endedAt ? new Date(args.endedAt) : null,
          loggedById: userId,
          metadata,
          startedAt: args.startedAt ? new Date(args.startedAt) : new Date(),
          type: args.type,
        })
        .returning();

      return event;
    },
    type: BabyEventType,
  })
);

builder.mutationField("updateEvent", (t) =>
  t.field({
    args: {
      diaperMeta: t.arg({ required: false, type: DiaperMetadataInput }),
      endedAt: t.arg.string({ required: false }),
      feedMeta: t.arg({ required: false, type: FeedMetadataInput }),
      id: t.arg.string({ required: true }),
      noteMeta: t.arg({ required: false, type: NoteMetadataInput }),
      pumpMeta: t.arg({ required: false, type: PumpMetadataInput }),
      sleepMeta: t.arg({ required: false, type: SleepMetadataInput }),
      startedAt: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const { householdId } = await requireHousehold(ctx);

      // Fetch event and verify household access
      const [existing] = await ctx.db
        .select()
        .from(events)
        .where(eq(events.id, args.id))
        .limit(1);
      if (!existing) throw new Error("Event not found");
      await requireBabyAccess(ctx, existing.babyId, householdId);

      const updates: Record<string, unknown> = {};
      if (args.startedAt !== undefined && args.startedAt !== null) {
        updates.startedAt = new Date(args.startedAt);
      }
      if (args.endedAt !== undefined && args.endedAt !== null) {
        updates.endedAt = new Date(args.endedAt);
      }

      // If any metadata input is provided, rebuild metadata
      const hasMeta =
        args.feedMeta ||
        args.sleepMeta ||
        args.diaperMeta ||
        args.noteMeta ||
        args.pumpMeta;
      if (hasMeta) {
        updates.metadata = buildMetadata(existing.type, args);
      }

      if (Object.keys(updates).length === 0) {
        return existing;
      }

      const [updated] = await ctx.db
        .update(events)
        .set(updates)
        .where(eq(events.id, args.id))
        .returning();

      return updated;
    },
    type: BabyEventType,
  })
);

builder.mutationField("deleteEvent", (t) =>
  t.field({
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { householdId } = await requireHousehold(ctx);

      const [existing] = await ctx.db
        .select()
        .from(events)
        .where(eq(events.id, args.id))
        .limit(1);
      if (!existing) throw new Error("Event not found");
      await requireBabyAccess(ctx, existing.babyId, householdId);

      await ctx.db.delete(events).where(eq(events.id, args.id));

      return true;
    },
    type: "Boolean",
  })
);
