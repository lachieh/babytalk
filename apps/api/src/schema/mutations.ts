import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

import {
  approveDeviceCode,
  pollDeviceCode,
  requestDeviceCode,
} from "../auth/device-code";
import { requestMagicLink, verifyMagicLink } from "../auth/magic-link";
import {
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  revokePasskey,
  startPasskeyAuthentication,
  startPasskeyRegistration,
} from "../auth/passkey";
import { builder } from "./builder";
import {
  AuthPayloadType,
  DeviceCodePollPayloadType,
  DeviceCodeRequestType,
  PasskeyOptionsType,
  PasskeyType,
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

builder.mutationField("passkeyRegisterStart", (t) =>
  t.field({
    resolve: async (_root, _args, ctx) => {
      if (!ctx.currentUser) throw new Error("Not authenticated");
      const options = await startPasskeyRegistration(
        ctx.currentUser.sub,
        ctx.currentUser.email
      );
      return { optionsJSON: JSON.stringify(options) };
    },
    type: PasskeyOptionsType,
  })
);

builder.mutationField("passkeyRegisterFinish", (t) =>
  t.field({
    args: {
      nickname: t.arg.string({ required: false }),
      response: t.arg.string({ required: true }),
    },
    nullable: true,
    resolve: (_root, args, ctx) => {
      if (!ctx.currentUser) throw new Error("Not authenticated");
      const parsed = JSON.parse(args.response) as RegistrationResponseJSON;
      return finishPasskeyRegistration(parsed, args.nickname ?? null);
    },
    type: PasskeyType,
  })
);

builder.mutationField("passkeyAuthStart", (t) =>
  t.field({
    args: {
      email: t.arg.string({ required: false }),
    },
    resolve: async (_root, args) => {
      const options = await startPasskeyAuthentication(args.email ?? null);
      return { optionsJSON: JSON.stringify(options) };
    },
    type: PasskeyOptionsType,
  })
);

builder.mutationField("passkeyAuthFinish", (t) =>
  t.field({
    args: {
      response: t.arg.string({ required: true }),
    },
    nullable: true,
    resolve: async (_root, args) => {
      const parsed = JSON.parse(args.response) as AuthenticationResponseJSON;
      const result = await finishPasskeyAuthentication(parsed);
      if (!result) return null;
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

builder.mutationField("passkeyRevoke", (t) =>
  t.field({
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: (_root, args, ctx) => {
      if (!ctx.currentUser) throw new Error("Not authenticated");
      return revokePasskey(ctx.currentUser.sub, args.id);
    },
    type: "Boolean",
  })
);
