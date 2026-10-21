import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { enforceRequestRateLimit } from "@/lib/rate-limit";
import { generateSlug } from "@/lib/slug";
import { hashSecretToken, isSingleUseTokenUsable } from "@/lib/tokens";
import { acceptOrganisationInvitationSchema } from "@/lib/validation";

class InvitationUnavailableError extends Error {}

/**
 * POST /api/v1/auth/organisation-invitations/accept
 * Accept an organisation invitation and create the organisation with the first admin user
 */
export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    await enforceRequestRateLimit(request, "org-invite-accept", 10, 60 * 60);

    const parsed = acceptOrganisationInvitationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.flatten());
    }

    const tokenHash = hashSecretToken(parsed.data.token);

    const invitation = await db.organisationInvitation.findUnique({
      where: { tokenHash },
    });

    if (
      !invitation ||
      !isSingleUseTokenUsable({
        expiresAt: invitation.expiresAt,
        consumedAt: invitation.acceptedAt,
      })
    ) {
      return NextResponse.json(
        { error: "This invitation is invalid or has expired." },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: invitation.primaryAdminEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email address already exists. Please sign in instead." },
        { status: 409 },
      );
    }

    const slug = await generateSlug(invitation.organisationName);

    await db.$transaction(async (tx) => {
      // Mark invitation as accepted
      const claimed = await tx.organisationInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new InvitationUnavailableError();
      }

      // Create the organisation
      const organisation = await tx.organisation.create({
        data: {
          name: invitation.organisationName,
          slug,
          status: "ACTIVE",
          tradingName: invitation.tradingName,
          companyRegistrationNo: invitation.companyRegistrationNo,
          contactEmail: invitation.contactEmail,
          contactPhone: invitation.contactPhone,
          registeredAddressLine1: invitation.registeredAddressLine1,
          registeredCity: invitation.registeredCity,
          registeredPostcode: invitation.registeredPostcode,
        },
      });

      // Update invitation with organisation reference
      await tx.organisationInvitation.update({
        where: { id: invitation.id },
        data: { organisationId: organisation.id },
      });

      // Create default head office branch
      await tx.branch.create({
        data: {
          organisationId: organisation.id,
          name: "Head Office",
          code: "HQ",
          status: "ACTIVE",
          isHeadOffice: true,
        },
      });

      // Create the admin user
      const user = await tx.user.create({
        data: {
          name: invitation.primaryAdminName,
          email: invitation.primaryAdminEmail,
          passwordHash: await hashPassword(parsed.data.password),
          emailVerified: new Date(),
        },
      });

      // Create ORG_ADMIN membership
      await tx.membership.create({
        data: {
          userId: user.id,
          organisationId: organisation.id,
          role: "ORG_ADMIN",
          active: true,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          organisationId: organisation.id,
          actorUserId: user.id,
          action: "organisation.created",
          entityType: "Organisation",
          entityId: organisation.id,
          metadata: {
            source: "invitation",
            invitationId: invitation.id,
          },
        },
      });

      // Create platform audit log
      await tx.platformAuditLog.create({
        data: {
          actorUserId: user.id,
          action: "organisation.invitation.accepted",
          entityType: "OrganisationInvitation",
          entityId: invitation.id,
          targetOrgId: organisation.id,
          metadata: {
            organisationName: organisation.name,
            adminEmail: user.email,
          },
        },
      });
    });

    return NextResponse.json({
      data: {
        accepted: true,
        message: "Organisation created successfully. You can now sign in.",
      },
    });
  } catch (error) {
    if (error instanceof InvitationUnavailableError) {
      return NextResponse.json(
        { error: "This invitation is invalid or has expired." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
