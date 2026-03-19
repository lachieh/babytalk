import { db } from "@babytalk/db";
import type { Database } from "@babytalk/db";
import type { YogaInitialContext } from "graphql-yoga";

import { verifyToken } from "./auth/jwt";
import type { JwtPayload } from "./auth/jwt";

export interface Context {
  db: Database;
  currentUser: JwtPayload | null;
}

export const createContext = async (
  ctx: YogaInitialContext
): Promise<Context> => {
  const header = ctx.request.headers.get("authorization");
  let currentUser: JwtPayload | null = null;

  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    currentUser = await verifyToken(token);
  }

  return { currentUser, db };
};
