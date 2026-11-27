import { users } from "@bubsie/db";
import { eq } from "drizzle-orm";

import { getDeviceCodeRedirect } from "../auth/device-code";
import { listUserPasskeys } from "../auth/passkey";
import { builder } from "./builder";
import { notAuthenticated } from "./errors";
import { DeviceCodeRedirectType, PasskeyType, UserType } from "./types";

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
      if (!ctx.currentUser) throw notAuthenticated();
      return listUserPasskeys(ctx.currentUser.sub);
    },
    type: [PasskeyType],
  })
);

/* Unauthenticated: the phone that sent a device elsewhere watches for it to
 * arrive there. */
builder.queryField("deviceCodeRedirect", (t) =>
  t.field({
    args: {
      code: t.arg.string({ required: true }),
    },
    nullable: true,
    resolve: (_root, args) => getDeviceCodeRedirect(args.code),
    type: DeviceCodeRedirectType,
  })
);
