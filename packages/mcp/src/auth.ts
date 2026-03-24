import { jwtVerify } from "jose";

import { config } from "./env";

export interface AuthUser {
  sub: string;
  email: string;
}

const secret = new TextEncoder().encode(config.jwt_secret);

export const verifyToken = async (token: string): Promise<AuthUser | null> => {
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
