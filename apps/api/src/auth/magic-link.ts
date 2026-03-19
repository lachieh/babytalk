import { randomUUID } from "node:crypto";

import { db, magicLinks, users } from "@babytalk/db";
import { eq } from "drizzle-orm";

import { sendMagicLinkEmail } from "../email/send";
import { signToken } from "./jwt";

export const requestMagicLink = async (email: string): Promise<boolean> => {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(magicLinks).values({
    email: email.toLowerCase(),
    expiresAt,
    token,
  });

  await sendMagicLinkEmail(email.toLowerCase(), token);
  return true;
};

export const verifyMagicLink = async (
  token: string
): Promise<{ token: string; user: { id: string; email: string } } | null> => {
  const [link] = await db
    .select()
    .from(magicLinks)
    .where(eq(magicLinks.token, token))
    .limit(1);

  if (!link || link.usedAt || link.expiresAt < new Date()) {
    return null;
  }

  await db
    .update(magicLinks)
    .set({ usedAt: new Date() })
    .where(eq(magicLinks.id, link.id));

  const { email } = link;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let user: { id: string; email: string };

  if (existing) {
    user = { email: existing.email, id: existing.id };
  } else {
    const [created] = await db
      .insert(users)
      .values({ email })
      .returning({ email: users.email, id: users.id });
    user = created;
  }

  const jwt = await signToken(user.id, user.email);
  return { token: jwt, user };
};
