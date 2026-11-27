import { randomBytes } from "node:crypto";

import { db, deviceCodes, users } from "@bubsie/db";
import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";

import { codeTaken, refuse } from "../schema/errors";
import { issueAuthTokens } from "./session";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

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

const webOrigin = (input: string): string | null => {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
};

const findLink = async (code: string) => {
  const [link] = await db
    .select()
    .from(deviceCodes)
    .where(eq(deviceCodes.code, code))
    .limit(1);
  return link;
};

export interface DeviceCodeRequest {
  code: string;
  expiresAt: Date;
}

export const requestDeviceCode = async (
  rawCode?: string | null
): Promise<DeviceCodeRequest> => {
  const code =
    rawCode === null || rawCode === undefined
      ? generateCode()
      : normalizeCode(rawCode);
  if (!CODE_PATTERN.test(code)) throw refuse("Invalid device code");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  const inserted = await db
    .insert(deviceCodes)
    .values({ code, expiresAt })
    .onConflictDoNothing({ target: deviceCodes.code })
    .returning({ id: deviceCodes.id });
  if (inserted.length === 0) throw codeTaken();

  return { code, expiresAt };
};

export const approveDeviceCode = async (
  rawCode: string,
  userId: string
): Promise<boolean> => {
  const code = normalizeCode(rawCode);
  const link = await findLink(code);

  if (!link) return false;
  if (link.consumedAt) return false;
  if (link.redirectWebUrl) return false;
  if (link.expiresAt < new Date()) return false;
  if (link.approvedAt) return link.userId === userId;

  const approved = await db
    .update(deviceCodes)
    .set({ approvedAt: new Date(), userId })
    .where(
      and(
        eq(deviceCodes.id, link.id),
        isNull(deviceCodes.approvedAt),
        isNull(deviceCodes.consumedAt),
        isNull(deviceCodes.redirectWebUrl)
      )
    )
    .returning({ id: deviceCodes.id });
  if (approved.length > 0) return true;

  const after = await findLink(code);
  return Boolean(
    after?.approvedAt && !after.redirectWebUrl && after.userId === userId
  );
};

export const redirectDeviceCode = async (
  rawCode: string,
  rawWebUrl: string
): Promise<boolean> => {
  const webUrl = webOrigin(rawWebUrl);
  if (!webUrl) throw refuse("Server address must be an http or https URL");

  const redirected = await db
    .update(deviceCodes)
    .set({ redirectWebUrl: webUrl })
    .where(
      and(
        eq(deviceCodes.code, normalizeCode(rawCode)),
        isNull(deviceCodes.approvedAt),
        isNull(deviceCodes.consumedAt),
        isNull(deviceCodes.redirectWebUrl),
        gt(deviceCodes.expiresAt, new Date())
      )
    )
    .returning({ id: deviceCodes.id });
  return redirected.length > 0;
};

export const confirmDeviceCodeRedirect = async (
  rawCode: string
): Promise<boolean> => {
  const confirmed = await db
    .update(deviceCodes)
    .set({ redirectConfirmedAt: new Date() })
    .where(
      and(
        eq(deviceCodes.code, normalizeCode(rawCode)),
        isNotNull(deviceCodes.redirectWebUrl),
        gt(deviceCodes.expiresAt, new Date())
      )
    )
    .returning({ id: deviceCodes.id });
  return confirmed.length > 0;
};

export interface DeviceCodeRedirect {
  confirmed: boolean;
  webUrl: string;
}

export const getDeviceCodeRedirect = async (
  rawCode: string
): Promise<DeviceCodeRedirect | null> => {
  const link = await findLink(normalizeCode(rawCode));
  if (!link?.redirectWebUrl || link.expiresAt < new Date()) return null;
  return {
    confirmed: link.redirectConfirmedAt !== null,
    webUrl: link.redirectWebUrl,
  };
};

export type DeviceCodePollResult =
  | { status: "pending" | "expired" }
  | { status: "redirected"; webUrl: string }
  | {
      refreshToken: string;
      status: "approved";
      token: string;
      user: { id: string; email: string };
    };

export const pollDeviceCode = async (
  rawCode: string
): Promise<DeviceCodePollResult> => {
  const link = await findLink(normalizeCode(rawCode));

  if (!link) return { status: "expired" };
  if (link.consumedAt) return { status: "expired" };
  if (link.expiresAt < new Date()) return { status: "expired" };
  if (link.redirectWebUrl) {
    return { status: "redirected", webUrl: link.redirectWebUrl };
  }
  if (!link.approvedAt || !link.userId) return { status: "pending" };

  const result = await db
    .update(deviceCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(deviceCodes.id, link.id),
        isNotNull(deviceCodes.approvedAt),
        isNull(deviceCodes.consumedAt),
        isNull(deviceCodes.redirectWebUrl)
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

  const tokens = await issueAuthTokens(user);
  return { status: "approved", ...tokens, user };
};
