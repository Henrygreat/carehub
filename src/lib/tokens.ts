import { createHash, randomBytes } from "node:crypto";

export function createSecretToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSecretToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isSingleUseTokenUsable(
  token: { expiresAt: Date; consumedAt: Date | null },
  now = new Date(),
) {
  return token.consumedAt === null && token.expiresAt > now;
}
