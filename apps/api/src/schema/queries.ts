import { users } from "@babytalk/db";
import { eq } from "drizzle-orm";

import { listUserPasskeys } from "../auth/passkey";
import { builder } from "./builder";
import { PasskeyType, UserType } from "./types";

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

builder.queryField("myPasskeys", (t) =>
  t.field({
    resolve: (_root, _args, ctx) => {
      if (!ctx.currentUser) throw new Error("Not authenticated");
      return listUserPasskeys(ctx.currentUser.sub);
    },
    type: [PasskeyType],
  })
);
