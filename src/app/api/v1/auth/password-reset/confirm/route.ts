import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { enforceRequestRateLimit } from "@/lib/rate-limit";
import { hashSecretToken, isSingleUseTokenUsable } from "@/lib/tokens";
import { passwordResetConfirmSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    await enforceRequestRateLimit(request, "password-reset-confirm", 20, 60 * 60);
    const parsed = passwordResetConfirmSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());
    const tokenHash = hashSecretToken(parsed.data.token);
    const token = await db.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, consumedAt: true },
    });
    if (!token || !isSingleUseTokenUsable(token)) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    }

    await db.$transaction(async (transaction) => {
      const claimed = await transaction.passwordResetToken.updateMany({
        where: {
          id: token.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1) throw new TokenAlreadyUsedError();
      await transaction.user.update({
        where: { id: token.userId },
        data: {
          passwordHash: await hashPassword(parsed.data.password),
          sessionVersion: { increment: 1 },
        },
      });
      const memberships = await transaction.membership.findMany({
        where: { userId: token.userId, active: true },
        select: { id: true, organisationId: true },
      });
      if (memberships.length) {
        await transaction.auditLog.createMany({
          data: memberships.map((membership) => ({
            organisationId: membership.organisationId,
            actorUserId: token.userId,
            actorMembershipId: membership.id,
            action: "account.password_reset",
            entityType: "User",
            entityId: token.userId,
          })),
        });
      }
    });
    return NextResponse.json({ data: { reset: true } });
  } catch (error) {
    if (error instanceof TokenAlreadyUsedError) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    }
    return jsonError(error);
  }
}

class TokenAlreadyUsedError extends Error {}
