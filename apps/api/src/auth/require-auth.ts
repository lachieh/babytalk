import type { Context } from "../context";
import type { JwtPayload } from "./jwt";

export const requireCurrentUser = (
  ctx: Pick<Context, "currentUser">
): JwtPayload => {
  if (!ctx.currentUser) throw new Error("Not authenticated");
  return ctx.currentUser;
};
