import type { YogaInitialContext } from "graphql-yoga";
import { db } from "@babytalk/db";
import type { Database } from "@babytalk/db";
import { verifyToken, type JwtPayload } from "./auth/jwt.js";

export interface Context {
  db: Database;
  currentUser: JwtPayload | null;
}

export async function createContext(
  ctx: YogaInitialContext,
): Promise<Context> {
  const header = ctx.request.headers.get("authorization");
  let currentUser: JwtPayload | null = null;

  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    currentUser = await verifyToken(token);
  }

  return { db, currentUser };
}
