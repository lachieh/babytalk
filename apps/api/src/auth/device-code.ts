import { randomBytes } from "node:crypto";

import { db, deviceCodes, users } from "@babytalk/db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { signToken } from "./jwt";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_TTL_MS = 15 * 60 * 1000;

const generateCode = (): string => {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
};

const normalizeCode = (input: string): string =>
  input.replaceAll(/[\s-]/g, "").toUpperCase();

export interface DeviceCodeRequest {
  code: string;
  expiresAt: Date;
}

export const requestDeviceCode = async (): Promise<DeviceCodeRequest> => {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.insert(deviceCodes).values({
    code,
    expiresAt,
  });

  return { code, expiresAt };
};

export const approveDeviceCode = async (
  rawCode: string,
  userId: string
): Promise<boolean> => {
  const code = normalizeCode(rawCode);

  const [link] = await db
    .select()
    .from(deviceCodes)
    .where(eq(deviceCodes.code, code))
    .limit(1);

  if (!link) return false;
  if (link.consumedAt) return false;
  if (link.expiresAt < new Date()) return false;
  if (link.approvedAt) return link.userId === userId;

  await db
    .update(deviceCodes)
    .set({ approvedAt: new Date(), userId })
    .where(
      and(
        eq(deviceCodes.id, link.id),
        isNull(deviceCodes.approvedAt),
        isNull(deviceCodes.consumedAt)
      )
    );

  return true;
};

export interface DeviceCodePollResult {
  status: "pending" | "expired" | "approved";
  token?: string;
  user?: { id: string; email: string };
}

export const pollDeviceCode = async (
  rawCode: string
): Promise<DeviceCodePollResult> => {
  const code = normalizeCode(rawCode);

  const [link] = await db
    .select()
    .from(deviceCodes)
    .where(eq(deviceCodes.code, code))
    .limit(1);

  if (!link) return { status: "expired" };
  if (link.consumedAt) return { status: "expired" };
  if (link.expiresAt < new Date()) return { status: "expired" };
  if (!link.approvedAt || !link.userId) return { status: "pending" };

  const result = await db
    .update(deviceCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(deviceCodes.id, link.id),
        isNotNull(deviceCodes.approvedAt),
        isNull(deviceCodes.consumedAt)
      )
    )
    .returning({ id: deviceCodes.id });

  if (result.length === 0) return { status: "expired" };

  const [user] = await db
    .select({ email: users.email, id: users.id })
    .from(users)
    .where(eq(users.id, link.userId))
    .limit(1);

  if (!user) return { status: "expired" };

  const token = await signToken(user.id, user.email);
  return { status: "approved", token, user };
};
