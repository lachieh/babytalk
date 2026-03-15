import { builder } from "./builder.js";

export const UserType = builder.objectRef<{
  id: string;
  email: string;
  name: string | null;
}>("User");

UserType.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    email: t.exposeString("email"),
    name: t.exposeString("name", { nullable: true }),
  }),
});

export const AuthPayloadType = builder.objectRef<{
  token: string;
  user: { id: string; email: string; name: string | null };
}>("AuthPayload");

AuthPayloadType.implement({
  fields: (t) => ({
    token: t.exposeString("token"),
    user: t.field({
      type: UserType,
      resolve: (parent) => parent.user,
    }),
  }),
});
