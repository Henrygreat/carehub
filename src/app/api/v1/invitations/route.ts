import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, validationError } from "@/lib/api";
import { EmailDeliveryError, sendInvitationEmail } from "@/lib/email";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSecretToken, hashSecretToken } from "@/lib/tokens";
import { resolveTenantContext } from "@/lib/tenant";
import { invitationSchema } from "@/lib/validation";
import { requireAppUrl } from "@/lib/environment";

export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const context = await resolveTenantContext();
    assertPermission(context.membership, "users:invite");
    await enforceRateLimit(
      `invitations:${context.organisation.id}:${context.userId}`,
      20,
      60 * 60,
    );
    const parsed = invitationSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());
    const email = parsed.data.email.trim().toLowerCase();
    const existingMembership = await db.membership.findFirst({
      where: {
        organisationId: context.organisation.id,
        active: true,
        user: { email },
      },
      select: { id: true },
    });
    if (existingMembership) {
      return NextResponse.json({ error: "This email already has access to the organisation." }, { status: 409 });
    }
    const pendingInvitation = await db.invitation.findFirst({
      where: {
        organisationId: context.organisation.id,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (pendingInvitation) {
      return NextResponse.json({ error: "An invitation is already pending for this email." }, { status: 409 });
    }
    const token = createSecretToken();
    const invitation = await db.$transaction(async (transaction) => {
      const created = await transaction.invitation.create({
        data: {
          organisationId: context.organisation.id,
          invitedByMembershipId: context.membership.id,
          email,
          role: parsed.data.role,
          tokenHash: hashSecretToken(token),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        select: { id: true, role: true, expiresAt: true },
      });
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "invitation.created",
          entityType: "Invitation",
          entityId: created.id,
          metadata: { role: created.role },
        },
      });
      return created;
    });
    const url = new URL(`/invite/${token}`, requireAppUrl(process.env.APP_URL)).toString();
    try {
      await sendInvitationEmail({
        to: email,
        organisationName: context.organisation.name,
        role: invitation.role,
        acceptUrl: url,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      if (!(error instanceof EmailDeliveryError)) throw error;
      console.error(
        "Invitation email delivery failed",
        error.name,
      );
      await db.$transaction([
        db.invitation.update({
          where: { id: invitation.id },
          data: { expiresAt: new Date() },
        }),
        db.auditLog.create({
          data: {
            organisationId: context.organisation.id,
            actorUserId: context.userId,
            actorMembershipId: context.membership.id,
            action: "invitation.email_delivery_failed",
            entityType: "Invitation",
            entityId: invitation.id,
          },
        }),
      ]);
      return NextResponse.json({ error: "Invitation email could not be sent. Please try again." }, { status: 503 });
    }
    return NextResponse.json({ data: invitation }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
