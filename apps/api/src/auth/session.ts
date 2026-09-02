import { db, refreshSessions, users } from "@babytalk/db";
import { and, eq, gt, isNull } from "drizzle-orm";

import { signToken } from "./jwt";
import { createRefreshToken, hashRefreshToken } from "./refresh-token";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface AuthUser {
  email: string;
  id: string;
}

export interface AuthTokens {
  refreshToken: string;
  token: string;
  user: AuthUser;
}

export const issueAuthTokens = async (user: AuthUser): Promise<AuthTokens> => {
  const refreshToken = createRefreshToken();
  await db.insert(refreshSessions).values({
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    tokenHash: hashRefreshToken(refreshToken),
    userId: user.id,
  });
  return { refreshToken, token: await signToken(user.id, user.email), user };
};

export const rotateRefreshToken = async (
  refreshToken: string
): Promise<AuthTokens | null> => {
  const tokenHash = hashRefreshToken(refreshToken);
  const [session] = await db
    .select({ email: users.email, id: users.id, sessionId: refreshSessions.id })
    .from(refreshSessions)
    .innerJoin(users, eq(users.id, refreshSessions.userId))
    .where(
      and(
        eq(refreshSessions.tokenHash, tokenHash),
        gt(refreshSessions.expiresAt, new Date()),
        isNull(refreshSessions.revokedAt)
      )
    )
    .limit(1);

  if (!session) return null;

  const revoked = await db
    .update(refreshSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshSessions.id, session.sessionId),
        isNull(refreshSessions.revokedAt)
      )
    )
    .returning({ id: refreshSessions.id });
  if (revoked.length === 0) return null;

  return issueAuthTokens({ email: session.email, id: session.id });
};
