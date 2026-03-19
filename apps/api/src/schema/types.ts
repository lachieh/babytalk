import { builder } from "./builder";

export const UserType = builder.objectRef<{
  id: string;
  email: string;
  name: string | null;
}>("User");

UserType.implement({
  fields: (t) => ({
    email: t.exposeString("email"),
    id: t.exposeString("id"),
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
      resolve: (parent) => parent.user,
      type: UserType,
    }),
  }),
});
