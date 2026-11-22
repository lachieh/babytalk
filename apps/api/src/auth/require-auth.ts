import type { Context } from "../context";
import { notAuthenticated } from "../schema/errors";
import type { JwtPayload } from "./jwt";

export const requireCurrentUser = (
  ctx: Pick<Context, "currentUser">
): JwtPayload => {
  if (!ctx.currentUser) throw notAuthenticated();
  return ctx.currentUser;
};
