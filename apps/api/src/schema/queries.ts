import { users } from "@babytalk/db";
import { eq } from "drizzle-orm";

import { builder } from "./builder";
import { UserType } from "./types";

builder.queryField("me", (t) =>
  t.field({
    nullable: true,
    resolve: async (_root, _args, ctx) => {
      if (!ctx.currentUser) {
        return null;
      }

      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, ctx.currentUser.sub))
        .limit(1);

      return user ?? null;
    },
    type: UserType,
  })
);
