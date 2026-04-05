import { requestMagicLink, verifyMagicLink } from "../auth/magic-link";
import { builder } from "./builder";
import { AuthPayloadType } from "./types";

builder.mutationField("requestMagicLink", (t) =>
  t.field({
    args: {
      email: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      try {
        return await requestMagicLink(args.email);
      } catch (error) {
        console.error("[requestMagicLink]", error);
        throw error;
      }
    },
    type: "Boolean",
  })
);

builder.mutationField("verifyMagicLink", (t) =>
  t.field({
    args: {
      token: t.arg.string({ required: true }),
    },
    nullable: true,
    resolve: async (_root, args) => {
      const result = await verifyMagicLink(args.token);
      if (!result) {
        return null;
      }
      return {
        token: result.token,
        user: {
          email: result.user.email,
          householdId: null,
          id: result.user.id,
          name: null,
        },
      };
    },
    type: AuthPayloadType,
  })
);
