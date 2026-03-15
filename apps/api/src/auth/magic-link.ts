import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, magicLinks, users } from "@babytalk/db";
import { signToken } from "./jwt.js";
import { sendMagicLinkEmail } from "../email/send.js";

export async function requestMagicLink(email: string): Promise<boolean> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(magicLinks).values({
    token,
    email: email.toLowerCase(),
    expiresAt,
  });

  await sendMagicLinkEmail(email.toLowerCase(), token);
  return true;
}

export async function verifyMagicLink(
  token: string,
): Promise<{ token: string; user: { id: string; email: string } } | null> {
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

  const email = link.email;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let user: { id: string; email: string };

  if (existing) {
    user = { id: existing.id, email: existing.email };
  } else {
    const [created] = await db
      .insert(users)
      .values({ email })
      .returning({ id: users.id, email: users.email });
    user = created;
  }

  const jwt = await signToken(user.id, user.email);
  return { token: jwt, user };
}
