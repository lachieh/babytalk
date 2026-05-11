import { agentThreads, babies, users } from "@babytalk/db";
import { and, eq } from "drizzle-orm";

import type { Context } from "../context";
import { builder } from "./builder";

const requireAuth = (ctx: Context): string => {
  if (!ctx.currentUser) throw new Error("Not authenticated");
  return ctx.currentUser.sub;
};

const requireBabyInHousehold = async (
  ctx: Context,
  babyId: string
): Promise<void> => {
  const userId = requireAuth(ctx);
  const [user] = await ctx.db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.householdId) throw new Error("No household");

  const [baby] = await ctx.db
    .select({ id: babies.id })
    .from(babies)
    .where(and(eq(babies.id, babyId), eq(babies.householdId, user.householdId)))
    .limit(1);
  if (!baby) throw new Error("Baby not found in household");
};

// --- Object Type ---

const AgentThreadType = builder.objectRef<{
  activityKey: string;
  babyId: string;
  id: string;
  state: unknown;
  tamboLastRunId: string | null;
  tamboThreadId: string | null;
  updatedAt: Date;
}>("AgentThread");

AgentThreadType.implement({
  fields: (t) => ({
    activityKey: t.exposeString("activityKey"),
    babyId: t.exposeString("babyId"),
    id: t.exposeString("id"),
    state: t.field({
      resolve: (parent) => JSON.stringify(parent.state ?? {}),
      type: "String",
    }),
    tamboLastRunId: t.exposeString("tamboLastRunId", { nullable: true }),
    tamboThreadId: t.exposeString("tamboThreadId", { nullable: true }),
    updatedAt: t.field({
      resolve: (parent) => parent.updatedAt.toISOString(),
      type: "String",
    }),
  }),
});

// --- Query ---

builder.queryField("agentThread", (t) =>
  t.field({
    args: {
      activityKey: t.arg.string({ required: true }),
      babyId: t.arg.string({ required: true }),
    },
    nullable: true,
    resolve: async (_root, args, ctx) => {
      await requireBabyInHousehold(ctx, args.babyId);
      const [row] = await ctx.db
        .select()
        .from(agentThreads)
        .where(
          and(
            eq(agentThreads.babyId, args.babyId),
            eq(agentThreads.activityKey, args.activityKey)
          )
        )
        .limit(1);
      return row ?? null;
    },
    type: AgentThreadType,
  })
);

// --- Mutation: upsert thread pointers and/or state patch ---

builder.mutationField("updateAgentThread", (t) =>
  t.field({
    args: {
      activityKey: t.arg.string({ required: true }),
      babyId: t.arg.string({ required: true }),
      statePatchJson: t.arg.string({ required: false }),
      tamboLastRunId: t.arg.string({ required: false }),
      tamboThreadId: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      await requireBabyInHousehold(ctx, args.babyId);

      let patch: Record<string, unknown> | null = null;
      if (args.statePatchJson) {
        try {
          const parsed = JSON.parse(args.statePatchJson);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            patch = parsed as Record<string, unknown>;
          }
        } catch {
          throw new Error("statePatchJson must be a JSON object");
        }
      }

      const [existing] = await ctx.db
        .select()
        .from(agentThreads)
        .where(
          and(
            eq(agentThreads.babyId, args.babyId),
            eq(agentThreads.activityKey, args.activityKey)
          )
        )
        .limit(1);

      const nextState = patch
        ? {
            ...(existing?.state as Record<string, unknown> | undefined),
            ...patch,
          }
        : (existing?.state ?? {});

      if (existing) {
        const updates: Record<string, unknown> = {
          state: nextState,
          updatedAt: new Date(),
        };
        if (args.tamboThreadId !== undefined && args.tamboThreadId !== null) {
          updates.tamboThreadId = args.tamboThreadId;
        }
        if (args.tamboLastRunId !== undefined && args.tamboLastRunId !== null) {
          updates.tamboLastRunId = args.tamboLastRunId;
        }
        const [updated] = await ctx.db
          .update(agentThreads)
          .set(updates)
          .where(eq(agentThreads.id, existing.id))
          .returning();
        return updated;
      }

      const [inserted] = await ctx.db
        .insert(agentThreads)
        .values({
          activityKey: args.activityKey,
          babyId: args.babyId,
          state: nextState,
          tamboLastRunId: args.tamboLastRunId ?? null,
          tamboThreadId: args.tamboThreadId ?? null,
        })
        .returning();
      return inserted;
    },
    type: AgentThreadType,
  })
);
