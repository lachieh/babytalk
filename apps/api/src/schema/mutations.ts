import { builder } from "./builder.js";
import { AuthPayloadType } from "./types.js";
import {
  requestMagicLink,
  verifyMagicLink,
} from "../auth/magic-link.js";

builder.mutationField("requestMagicLink", (t) =>
  t.field({
    type: "Boolean",
    args: {
      email: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      return requestMagicLink(args.email);
    },
  }),
);

builder.mutationField("verifyMagicLink", (t) =>
  t.field({
    type: AuthPayloadType,
    nullable: true,
    args: {
      token: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      const result = await verifyMagicLink(args.token);
      if (!result) return null;
      return {
        token: result.token,
        user: { id: result.user.id, email: result.user.email, name: null },
      };
    },
  }),
);
