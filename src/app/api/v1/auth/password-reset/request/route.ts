import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError } from "@/lib/api";
import { EmailDeliveryError, sendPasswordResetEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { enforceRateLimit, enforceRequestRateLimit } from "@/lib/rate-limit";
import { createSecretToken, hashSecretToken } from "@/lib/tokens";
import { passwordResetRequestSchema } from "@/lib/validation";
import { requireAppUrl } from "@/lib/environment";

const genericResponse = {
  message: "If an account matches that email, password reset instructions will be sent.",
};

export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    await enforceRequestRateLimit(request, "password-reset-request", 10, 60 * 60);
    const body: unknown = await request.json();
    const parsed = passwordResetRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json(genericResponse, { status: 202 });

    const email = parsed.data.email.trim().toLowerCase();
    const emailKey = createHash("sha256").update(email).digest("hex");
    await enforceRateLimit(`password-reset:${emailKey}`, 3, 60 * 60);
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, disabledAt: true },
    });
    if (!user || user.disabledAt) return NextResponse.json(genericResponse, { status: 202 });

    const token = createSecretToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.$transaction(async (transaction) => {
      await transaction.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await transaction.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashSecretToken(token),
          expiresAt,
        },
      });
      const memberships = await transaction.membership.findMany({
        where: { userId: user.id, active: true },
        select: { id: true, organisationId: true },
      });
      if (memberships.length) {
        await transaction.auditLog.createMany({
          data: memberships.map((membership) => ({
            organisationId: membership.organisationId,
            actorUserId: user.id,
            actorMembershipId: membership.id,
            action: "account.password_reset_requested",
            entityType: "User",
            entityId: user.id,
          })),
        });
      }
    });
    const url = new URL(
      `/reset-password#token=${encodeURIComponent(token)}`,
      requireAppUrl(process.env.APP_URL),
    ).toString();
    try {
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl: url,
        expiresAt,
      });
    } catch (error) {
      if (!(error instanceof EmailDeliveryError)) throw error;
      console.error("Password reset email delivery failed", error.name);
      await db.passwordResetToken.deleteMany({
        where: { userId: user.id, tokenHash: hashSecretToken(token) },
      });
    }
    return NextResponse.json(genericResponse, { status: 202 });
  } catch (error) {
    return jsonError(error);
  }
}
