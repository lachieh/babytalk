import { eq } from "drizzle-orm";
import { users } from "@babytalk/db";
import { builder } from "./builder.js";
import { UserType } from "./types.js";

builder.queryField("me", (t) =>
  t.field({
    type: UserType,
    nullable: true,
    resolve: async (_root, _args, ctx) => {
      if (!ctx.currentUser) return null;

      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, ctx.currentUser.sub))
        .limit(1);

      return user ?? null;
    },
  }),
);
