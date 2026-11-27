import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

import {
  approveDeviceCode,
  confirmDeviceCodeRedirect,
  pollDeviceCode,
  redirectDeviceCode,
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
import { rotateRefreshToken } from "../auth/session";
import { builder } from "./builder";
import { notAuthenticated, refuse } from "./errors";
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
        refreshToken: result.refreshToken,
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

builder.mutationField("refreshToken", (t) =>
  t.field({
    args: {
      refreshToken: t.arg.string({ required: true }),
    },
    nullable: true,
    resolve: async (_root, args) => {
      const result = await rotateRefreshToken(args.refreshToken);
      // Explicit, so a client ends its session only on this answer and keeps
      // it through an outage.
      if (!result) throw refuse("Refresh token rejected");
      return {
        refreshToken: result.refreshToken,
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
    args: {
      code: t.arg.string(),
    },
    resolve: (_root, args) => requestDeviceCode(args.code),
    type: DeviceCodeRequestType,
  })
);

builder.mutationField("approveDeviceCode", (t) =>
  t.field({
    args: {
      code: t.arg.string({ required: true }),
    },
    resolve: (_root, args, ctx) => {
      if (!ctx.currentUser) throw notAuthenticated();
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
      if (result.status !== "approved") {
        return {
          refreshToken: null,
          status: result.status,
          token: null,
          user: null,
          webUrl: result.status === "redirected" ? result.webUrl : null,
        };
      }
      return {
        refreshToken: result.refreshToken,
        status: result.status,
        token: result.token,
        user: {
          email: result.user.email,
          householdId: null,
          id: result.user.id,
          name: null,
        },
        webUrl: null,
      };
    },
    type: DeviceCodePollPayloadType,
  })
);

builder.mutationField("redirectDeviceCode", (t) =>
  t.field({
    args: {
      code: t.arg.string({ required: true }),
      webUrl: t.arg.string({ required: true }),
    },
    resolve: (_root, args) => redirectDeviceCode(args.code, args.webUrl),
    type: "Boolean",
  })
);

builder.mutationField("confirmDeviceCodeRedirect", (t) =>
  t.field({
    args: {
      code: t.arg.string({ required: true }),
    },
    resolve: (_root, args) => confirmDeviceCodeRedirect(args.code),
    type: "Boolean",
  })
);

builder.mutationField("passkeyRegisterStart", (t) =>
  t.field({
    resolve: async (_root, _args, ctx) => {
      if (!ctx.currentUser) throw notAuthenticated();
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
      if (!ctx.currentUser) throw notAuthenticated();
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
        refreshToken: result.refreshToken,
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
      if (!ctx.currentUser) throw notAuthenticated();
      return revokePasskey(ctx.currentUser.sub, args.id);
    },
    type: "Boolean",
  })
);
