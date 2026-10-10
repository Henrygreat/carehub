import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { enforceRequestRateLimit } from "@/lib/rate-limit";
import { hashSecretToken, isSingleUseTokenUsable } from "@/lib/tokens";
import { acceptInvitationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    await enforceRequestRateLimit(request, "invite-accept", 20, 60 * 60);
    const parsed = acceptInvitationSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());
    const invitationHash = hashSecretToken(parsed.data.token);
    const invitation = await db.invitation.findUnique({
      where: { tokenHash: invitationHash },
    });
    if (
      !invitation ||
      !isSingleUseTokenUsable({
        expiresAt: invitation.expiresAt,
        consumedAt: invitation.acceptedAt,
      })
    ) {
      return NextResponse.json({ error: "This invitation is invalid or has expired." }, { status: 400 });
    }

    await db.$transaction(async (transaction) => {
      const claimed = await transaction.invitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new InvitationUnavailableError();

      const existingUser = await transaction.user.findUnique({
        where: { email: invitation.email },
      });
      if (existingUser?.disabledAt) throw new InvitationUnavailableError();
      const user =
        existingUser ??
        (await transaction.user.create({
          data: {
            name: parsed.data.name,
            email: invitation.email,
            passwordHash: await hashPassword(parsed.data.password),
            emailVerified: new Date(),
          },
        }));
      const existingMembership = await transaction.membership.findUnique({
        where: {
          userId_organisationId: {
            userId: user.id,
            organisationId: invitation.organisationId,
          },
        },
      });
      if (existingMembership?.active) throw new InvitationUnavailableError();
      if (existingMembership) {
        await transaction.membership.update({
          where: { id: existingMembership.id },
          data: { role: invitation.role, active: true },
        });
      } else {
        await transaction.membership.create({
          data: {
            userId: user.id,
            organisationId: invitation.organisationId,
            role: invitation.role,
          },
        });
      }
      const matchingProfiles = await transaction.staffProfile.findMany({
        where: {
          organisationId: invitation.organisationId,
          email: { equals: invitation.email, mode: "insensitive" },
          membershipUserId: null,
        },
        select: { id: true },
        take: 2,
      });
      if (matchingProfiles.length === 1) {
        await transaction.staffProfile.update({
          where: { id_organisationId: { id: matchingProfiles[0].id, organisationId: invitation.organisationId } },
          data: { membershipUserId: user.id },
        });
      }
      await transaction.auditLog.create({
        data: {
          organisationId: invitation.organisationId,
          actorUserId: user.id,
          action: "invitation.accepted",
          entityType: "Invitation",
          entityId: invitation.id,
          metadata: { role: invitation.role },
        },
      });
    });
    return NextResponse.json({ data: { accepted: true } });
  } catch (error) {
    if (error instanceof InvitationUnavailableError) {
      return NextResponse.json({ error: "This invitation is invalid or has expired." }, { status: 400 });
    }
    return jsonError(error);
  }
}

class InvitationUnavailableError extends Error {}
