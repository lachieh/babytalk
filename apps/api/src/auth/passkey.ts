import { db, userCredentials, users, webauthnChallenges } from "@babytalk/db";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { and, eq, gt } from "drizzle-orm";

import { config } from "../env";
import { signToken } from "./jwt";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const rpId = new URL(config.webUrl).hostname;
const rpOrigin = config.webUrl.replace(/\/$/, "");
const { rpName } = config;

const fromBase64Url = (b: string): Uint8Array<ArrayBuffer> => {
  const buf = Buffer.from(b, "base64url");
  const out = new Uint8Array(new ArrayBuffer(buf.length));
  out.set(buf);
  return out;
};
const toBase64Url = (b: Uint8Array): string =>
  Buffer.from(b).toString("base64url");

const parseTransports = (
  raw: string | null
): AuthenticatorTransportFuture[] | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as AuthenticatorTransportFuture[];
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const extractChallenge = (clientDataJSON: string): string | null => {
  try {
    const parsed = JSON.parse(
      Buffer.from(clientDataJSON, "base64url").toString("utf8")
    ) as { challenge?: string };
    return parsed.challenge ?? null;
  } catch {
    return null;
  }
};

const recordChallenge = async (
  challenge: string,
  type: "registration" | "authentication",
  userId: string | null,
  email: string | null
): Promise<void> => {
  await db.insert(webauthnChallenges).values({
    challenge,
    email,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    type,
    userId,
  });
};

const consumeChallenge = async (
  challenge: string,
  type: "registration" | "authentication"
): Promise<{ userId: string | null; email: string | null } | null> => {
  const [row] = await db
    .select()
    .from(webauthnChallenges)
    .where(
      and(
        eq(webauthnChallenges.challenge, challenge),
        eq(webauthnChallenges.type, type),
        gt(webauthnChallenges.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!row) return null;

  await db.delete(webauthnChallenges).where(eq(webauthnChallenges.id, row.id));

  return { email: row.email, userId: row.userId };
};

export const startPasskeyRegistration = async (
  userId: string,
  email: string
): Promise<PublicKeyCredentialCreationOptionsJSON> => {
  const existing = await db
    .select({
      credentialId: userCredentials.credentialId,
      transports: userCredentials.transports,
    })
    .from(userCredentials)
    .where(eq(userCredentials.userId, userId));

  const options = await generateRegistrationOptions({
    attestationType: "none",
    authenticatorSelection: {
      requireResidentKey: true,
      residentKey: "required",
      userVerification: "preferred",
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: parseTransports(c.transports),
    })),
    rpID: rpId,
    rpName,
    userID: new TextEncoder().encode(userId),
    userName: email,
  });

  await recordChallenge(options.challenge, "registration", userId, email);
  return options;
};

export interface PasskeyInfo {
  backedUp: boolean;
  createdAt: Date;
  credentialId: string;
  deviceType: string;
  id: string;
  lastUsedAt: Date | null;
  nickname: string | null;
}

export const finishPasskeyRegistration = async (
  response: RegistrationResponseJSON,
  nickname: string | null
): Promise<PasskeyInfo | null> => {
  const challenge = extractChallenge(response.response.clientDataJSON);
  if (!challenge) return null;

  const challengeRow = await consumeChallenge(challenge, "registration");
  if (!challengeRow?.userId) return null;

  const verification = await verifyRegistrationResponse({
    expectedChallenge: challenge,
    expectedOrigin: rpOrigin,
    expectedRPID: rpId,
    requireUserVerification: false,
    response,
  });

  if (!(verification.verified && verification.registrationInfo)) return null;

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  const [inserted] = await db
    .insert(userCredentials)
    .values({
      backedUp: credentialBackedUp,
      counter: credential.counter,
      credentialId: credential.id,
      deviceType: credentialDeviceType,
      nickname: nickname?.trim() || null,
      publicKey: toBase64Url(credential.publicKey),
      transports: credential.transports
        ? JSON.stringify(credential.transports)
        : null,
      userId: challengeRow.userId,
    })
    .returning();

  return {
    backedUp: inserted.backedUp,
    createdAt: inserted.createdAt,
    credentialId: inserted.credentialId,
    deviceType: inserted.deviceType,
    id: inserted.id,
    lastUsedAt: inserted.lastUsedAt,
    nickname: inserted.nickname,
  };
};

export const startPasskeyAuthentication = async (
  email: string | null
): Promise<PublicKeyCredentialRequestOptionsJSON> => {
  let allowCredentials:
    | PublicKeyCredentialRequestOptionsJSON["allowCredentials"]
    | undefined;
  let resolvedUserId: string | null = null;

  if (email) {
    const normalized = email.toLowerCase();
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);

    if (user) {
      resolvedUserId = user.id;
      const creds = await db
        .select({
          credentialId: userCredentials.credentialId,
          transports: userCredentials.transports,
        })
        .from(userCredentials)
        .where(eq(userCredentials.userId, user.id));

      allowCredentials = creds.map((c) => ({
        id: c.credentialId,
        transports: parseTransports(c.transports),
        type: "public-key" as const,
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    allowCredentials,
    rpID: rpId,
    userVerification: "preferred",
  });

  await recordChallenge(
    options.challenge,
    "authentication",
    resolvedUserId,
    email?.toLowerCase() ?? null
  );

  return options;
};

export interface PasskeyAuthResult {
  token: string;
  user: { email: string; id: string };
}

export const finishPasskeyAuthentication = async (
  response: AuthenticationResponseJSON
): Promise<PasskeyAuthResult | null> => {
  const challenge = extractChallenge(response.response.clientDataJSON);
  if (!challenge) return null;

  const challengeRow = await consumeChallenge(challenge, "authentication");
  if (!challengeRow) return null;

  const [cred] = await db
    .select()
    .from(userCredentials)
    .where(eq(userCredentials.credentialId, response.id))
    .limit(1);

  if (!cred) return null;
  if (challengeRow.userId && challengeRow.userId !== cred.userId) return null;

  const verification = await verifyAuthenticationResponse({
    credential: {
      counter: cred.counter,
      id: cred.credentialId,
      publicKey: fromBase64Url(cred.publicKey),
      transports: parseTransports(cred.transports),
    },
    expectedChallenge: challenge,
    expectedOrigin: rpOrigin,
    expectedRPID: rpId,
    requireUserVerification: false,
    response,
  });

  if (!verification.verified) return null;

  await db
    .update(userCredentials)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    })
    .where(eq(userCredentials.id, cred.id));

  const [user] = await db
    .select({ email: users.email, id: users.id })
    .from(users)
    .where(eq(users.id, cred.userId))
    .limit(1);

  if (!user) return null;

  const token = await signToken(user.id, user.email);
  return { token, user };
};

export const listUserPasskeys = async (
  userId: string
): Promise<PasskeyInfo[]> => {
  const rows = await db
    .select()
    .from(userCredentials)
    .where(eq(userCredentials.userId, userId));

  return rows.map((r) => ({
    backedUp: r.backedUp,
    createdAt: r.createdAt,
    credentialId: r.credentialId,
    deviceType: r.deviceType,
    id: r.id,
    lastUsedAt: r.lastUsedAt,
    nickname: r.nickname,
  }));
};

export const revokePasskey = async (
  userId: string,
  credentialId: string
): Promise<boolean> => {
  const result = await db
    .delete(userCredentials)
    .where(
      and(
        eq(userCredentials.id, credentialId),
        eq(userCredentials.userId, userId)
      )
    )
    .returning({ id: userCredentials.id });

  return result.length > 0;
};
