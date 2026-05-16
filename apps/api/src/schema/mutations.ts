import {
  approveDeviceCode,
  pollDeviceCode,
  requestDeviceCode,
} from "../auth/device-code";
import { requestMagicLink, verifyMagicLink } from "../auth/magic-link";
import { builder } from "./builder";
import {
  AuthPayloadType,
  DeviceCodePollPayloadType,
  DeviceCodeRequestType,
} from "./types";

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

builder.mutationField("requestDeviceCode", (t) =>
  t.field({
    resolve: () => requestDeviceCode(),
    type: DeviceCodeRequestType,
  })
);

builder.mutationField("approveDeviceCode", (t) =>
  t.field({
    args: {
      code: t.arg.string({ required: true }),
    },
    resolve: (_root, args, ctx) => {
      if (!ctx.currentUser) throw new Error("Not authenticated");
      return approveDeviceCode(args.code, ctx.currentUser.sub);
    },
    type: "Boolean",
  })
);

builder.mutationField("pollDeviceCode", (t) =>
  t.field({
    args: {
      code: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      const result = await pollDeviceCode(args.code);
      return {
        status: result.status,
        token: result.token ?? null,
        user: result.user
          ? {
              email: result.user.email,
              householdId: null,
              id: result.user.id,
              name: null,
            }
          : null,
      };
    },
    type: DeviceCodePollPayloadType,
  })
);
