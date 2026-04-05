import { SignJWT, jwtVerify } from "jose";

import { config } from "../env";

const secret = new TextEncoder().encode(config.jwtSecret);

export interface JwtPayload {
  sub: string;
  email: string;
}

export const signToken = (userId: string, email: string): Promise<string> =>
  new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

export const verifyToken = async (
  token: string
): Promise<JwtPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      email: payload.email as string,
      sub: payload.sub as string,
    };
  } catch {
    return null;
  }
};
