import { builder } from "./builder";

export const UserType = builder.objectRef<{
  email: string;
  householdId: string | null;
  id: string;
  name: string | null;
}>("User");

UserType.implement({
  fields: (t) => ({
    email: t.exposeString("email"),
    householdId: t.exposeString("householdId", { nullable: true }),
    id: t.exposeString("id"),
    name: t.exposeString("name", { nullable: true }),
  }),
});

export const AuthPayloadType = builder.objectRef<{
  token: string;
  user: {
    email: string;
    householdId: string | null;
    id: string;
    name: string | null;
  };
}>("AuthPayload");

AuthPayloadType.implement({
  fields: (t) => ({
    token: t.exposeString("token"),
    user: t.field({
      resolve: (parent) => parent.user,
      type: UserType,
    }),
  }),
});

export const DeviceCodeRequestType = builder.objectRef<{
  code: string;
  expiresAt: Date;
}>("DeviceCodeRequest");

DeviceCodeRequestType.implement({
  fields: (t) => ({
    code: t.exposeString("code"),
    expiresAt: t.string({
      resolve: (parent) => parent.expiresAt.toISOString(),
    }),
  }),
});

export const DeviceCodeStatusEnum = builder.enumType("DeviceCodeStatus", {
  values: ["pending", "expired", "approved"] as const,
});

export const DeviceCodePollPayloadType = builder.objectRef<{
  status: "pending" | "expired" | "approved";
  token: string | null;
  user: {
    email: string;
    householdId: string | null;
    id: string;
    name: string | null;
  } | null;
}>("DeviceCodePollPayload");

DeviceCodePollPayloadType.implement({
  fields: (t) => ({
    status: t.field({
      resolve: (parent) => parent.status,
      type: DeviceCodeStatusEnum,
    }),
    token: t.exposeString("token", { nullable: true }),
    user: t.field({
      nullable: true,
      resolve: (parent) => parent.user,
      type: UserType,
    }),
  }),
});

export const PasskeyOptionsType = builder.objectRef<{ optionsJSON: string }>(
  "PasskeyOptions"
);

PasskeyOptionsType.implement({
  fields: (t) => ({
    optionsJSON: t.exposeString("optionsJSON"),
  }),
});

export const PasskeyType = builder.objectRef<{
  backedUp: boolean;
  createdAt: Date;
  credentialId: string;
  deviceType: string;
  id: string;
  lastUsedAt: Date | null;
  nickname: string | null;
}>("Passkey");

PasskeyType.implement({
  fields: (t) => ({
    backedUp: t.exposeBoolean("backedUp"),
    createdAt: t.string({
      resolve: (parent) => parent.createdAt.toISOString(),
    }),
    credentialId: t.exposeString("credentialId"),
    deviceType: t.exposeString("deviceType"),
    id: t.exposeString("id"),
    lastUsedAt: t.string({
      nullable: true,
      resolve: (parent) => parent.lastUsedAt?.toISOString() ?? null,
    }),
    nickname: t.exposeString("nickname", { nullable: true }),
  }),
});
