import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation";

export async function authenticateCredentials(
  credentials: unknown,
  forwardedFor = "unknown",
) {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) {
    console.error("[Auth] Credential validation failed:", parsed.error.issues);
    return null;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const identifier = createHash("sha256").update(email).digest("hex");
  await enforceRateLimit(`login:${identifier}`, 10, 15 * 60);
  if (forwardedFor !== "unknown") {
    const addressHash = createHash("sha256").update(forwardedFor).digest("hex");
    await enforceRateLimit(`login-ip:${addressHash}`, 100, 15 * 60);
  }

  const user = await db.user.findUnique({
    where: { email },
    include: { memberships: { where: { active: true }, select: { id: true } } },
  });

  if (!user) {
    console.error("[Auth] User not found:", email);
    return null;
  }

  if (user.disabledAt) {
    console.error("[Auth] User is disabled:", email);
    return null;
  }

  if (user.memberships.length === 0) {
    console.error("[Auth] User has no active memberships:", email);
    return null;
  }

  const passwordValid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordValid) {
    console.error("[Auth] Password verification failed:", email);
    return null;
  }

  return { id: user.id, email: user.email, name: user.name };
}
