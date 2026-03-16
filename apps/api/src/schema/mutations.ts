import { requestMagicLink, verifyMagicLink } from "../auth/magic-link.js";
import { builder } from "./builder.js";
import { AuthPayloadType } from "./types.js";

builder.mutationField("requestMagicLink", (t) =>
  t.field({
    args: {
      email: t.arg.string({ required: true }),
    },
    resolve: (_root, args) => requestMagicLink(args.email),
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
        user: { email: result.user.email, id: result.user.id, name: null },
      };
    },
    type: AuthPayloadType,
  })
);
