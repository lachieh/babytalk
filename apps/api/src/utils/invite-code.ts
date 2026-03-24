import { randomBytes } from "node:crypto";

export const generateInviteCode = (): string => randomBytes(4).toString("hex");
