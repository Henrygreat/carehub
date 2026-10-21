import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { assertPlatformPermission } from "@/lib/permissions";
import {
  createPlatformAuditLog,
  getClientIp,
  getUserAgent,
  resolvePlatformAdminContext,
} from "@/lib/platform-admin";
import { createSecretToken, hashSecretToken } from "@/lib/tokens";
import { organisationInvitationSchema } from "@/lib/validation";

const INVITATION_EXPIRY_DAYS = 7;

/**
 * GET /api/v1/platform-admin/invitations
 * List pending organisation invitations (platform admin only)
 */
export async function GET() {
  try {
    const context = await resolvePlatformAdminContext();
    assertPlatformPermission(context.user, "platform:organisations:read");

    const invitations = await db.organisationInvitation.findMany({
      where: {
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        organisationName: true,
        tradingName: true,
        contactEmail: true,
        primaryAdminName: true,
        primaryAdminEmail: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return privateJson({ data: invitations });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * POST /api/v1/platform-admin/invitations
 * Create a new organisation invitation (platform admin only)
 */
export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolvePlatformAdminContext();
    assertPlatformPermission(context.user, "platform:organisations:invite");

    const parsed = organisationInvitationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.flatten());
    }

    const data = parsed.data;

    // Check if there's already a pending invitation for this admin email
    const existingInvitation = await db.organisationInvitation.findFirst({
      where: {
        primaryAdminEmail: data.primaryAdminEmail.toLowerCase(),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this administrator email." },
        { status: 409 },
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: data.primaryAdminEmail.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email address already exists." },
        { status: 409 },
      );
    }

    const token = createSecretToken();
    const tokenHash = hashSecretToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const invitation = await db.organisationInvitation.create({
      data: {
        organisationName: data.organisationName.trim(),
        tradingName: data.tradingName?.trim() || null,
        companyRegistrationNo: data.companyRegistrationNo?.trim() || null,
        contactEmail: data.contactEmail.toLowerCase(),
        contactPhone: data.contactPhone?.trim() || null,
        registeredAddressLine1: data.registeredAddressLine1?.trim() || null,
        registeredCity: data.registeredCity?.trim() || null,
        registeredPostcode: data.registeredPostcode?.trim() || null,
        primaryAdminName: data.primaryAdminName.trim(),
        primaryAdminEmail: data.primaryAdminEmail.toLowerCase(),
        tokenHash,
        expiresAt,
        invitedByUserId: context.userId,
      },
      select: {
        id: true,
        organisationName: true,
        primaryAdminName: true,
        primaryAdminEmail: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    await createPlatformAuditLog(context, "organisation.invitation.created", {
      entityType: "OrganisationInvitation",
      entityId: invitation.id,
      metadata: {
        organisationName: data.organisationName,
        primaryAdminEmail: data.primaryAdminEmail,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    // Return the token only once - it cannot be retrieved again
    return NextResponse.json(
      {
        data: {
          ...invitation,
          token, // Include token for sending invitation email
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
