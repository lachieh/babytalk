import { babies, measurements, users } from "@babytalk/db";
import { and, desc, eq } from "drizzle-orm";

import type { Context } from "../context";
import { builder } from "./builder";
import { MeasurementType } from "./measurement-types";

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

// --- Queries ---

builder.queryField("measurements", (t) =>
  t.field({
    args: {
      babyId: t.arg.string({ required: true }),
      limit: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const { householdId } = await requireHousehold(ctx);
      await requireBabyAccess(ctx, args.babyId, householdId);

      return ctx.db
        .select()
        .from(measurements)
        .where(eq(measurements.babyId, args.babyId))
        .orderBy(desc(measurements.measuredAt))
        .limit(args.limit ?? 50);
    },
    type: [MeasurementType],
  })
);

// --- Mutations ---

builder.mutationField("addMeasurement", (t) =>
  t.field({
    args: {
      babyId: t.arg.string({ required: true }),
      headMm: t.arg.int({ required: false }),
      lengthMm: t.arg.int({ required: false }),
      measuredAt: t.arg.string({ required: false }),
      notes: t.arg.string({ required: false }),
      weightG: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const { householdId, userId } = await requireHousehold(ctx);
      await requireBabyAccess(ctx, args.babyId, householdId);

      const [measurement] = await ctx.db
        .insert(measurements)
        .values({
          babyId: args.babyId,
          headMm: args.headMm ?? null,
          lengthMm: args.lengthMm ?? null,
          loggedById: userId,
          measuredAt: args.measuredAt ? new Date(args.measuredAt) : new Date(),
          notes: args.notes ?? null,
          weightG: args.weightG ?? null,
        })
        .returning();

      return measurement;
    },
    type: MeasurementType,
  })
);

builder.mutationField("updateMeasurement", (t) =>
  t.field({
    args: {
      headMm: t.arg.int({ required: false }),
      id: t.arg.string({ required: true }),
      lengthMm: t.arg.int({ required: false }),
      measuredAt: t.arg.string({ required: false }),
      notes: t.arg.string({ required: false }),
      weightG: t.arg.int({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const { householdId } = await requireHousehold(ctx);

      const [existing] = await ctx.db
        .select()
        .from(measurements)
        .where(eq(measurements.id, args.id))
        .limit(1);
      if (!existing) throw new Error("Measurement not found");
      await requireBabyAccess(ctx, existing.babyId, householdId);

      const updates: Record<string, unknown> = {};
      if (args.weightG !== undefined) updates.weightG = args.weightG;
      if (args.lengthMm !== undefined) updates.lengthMm = args.lengthMm;
      if (args.headMm !== undefined) updates.headMm = args.headMm;
      if (args.notes !== undefined) updates.notes = args.notes;
      if (args.measuredAt) updates.measuredAt = new Date(args.measuredAt);

      if (Object.keys(updates).length === 0) return existing;

      const [updated] = await ctx.db
        .update(measurements)
        .set(updates)
        .where(eq(measurements.id, args.id))
        .returning();

      return updated;
    },
    type: MeasurementType,
  })
);

builder.mutationField("deleteMeasurement", (t) =>
  t.field({
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { householdId } = await requireHousehold(ctx);

      const [existing] = await ctx.db
        .select()
        .from(measurements)
        .where(eq(measurements.id, args.id))
        .limit(1);
      if (!existing) throw new Error("Measurement not found");
      await requireBabyAccess(ctx, existing.babyId, householdId);

      await ctx.db.delete(measurements).where(eq(measurements.id, args.id));
      return true;
    },
    type: "Boolean",
  })
);
