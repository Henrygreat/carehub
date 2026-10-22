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
import { applicationReviewSchema } from "@/lib/validation";
import { provisionOrganisationFromApplication } from "@/lib/provisioning";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/platform-admin/applications/[id]
 * View application details (platform admin only)
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await resolvePlatformAdminContext();
    assertPlatformPermission(context.user, "platform:organisations:read");

    const application = await db.organisationApplication.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        tradingName: true,
        companyRegistrationNo: true,
        registeredAddressLine1: true,
        registeredAddressLine2: true,
        registeredCity: true,
        registeredPostcode: true,
        primaryContactName: true,
        primaryContactEmail: true,
        primaryContactPhone: true,
        careServiceTypes: true,
        cqcRegistrationNo: true,
        estimatedStaffCount: true,
        estimatedBranchCount: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
        reviewNotes: true,
        rejectionReason: true,
        organisationId: true,
        organisation: {
          select: { id: true, name: true, slug: true, status: true },
        },
        invitationId: true,
        privacyNoticeAccepted: true,
        termsAccepted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    return privateJson({ data: application });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * PATCH /api/v1/platform-admin/applications/[id]
 * Review application (mark under review, approve, or reject)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const { id } = await params;
    const context = await resolvePlatformAdminContext();
    assertPlatformPermission(context.user, "platform:organisations:update");

    const application = await db.organisationApplication.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        primaryContactEmail: true,
        primaryContactName: true,
        status: true,
        organisationId: true,
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = applicationReviewSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.flatten());
    }

    const { status, reviewNotes, rejectionReason } = parsed.data;

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      SUBMITTED: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
      UNDER_REVIEW: ["APPROVED", "REJECTED"],
      APPROVED: [], // Cannot change once approved
      REJECTED: [], // Cannot change once rejected
      WITHDRAWN: [],
      DRAFT: [],
    };

    const allowed = validTransitions[application.status] ?? [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Cannot change status from ${application.status} to ${status}.` },
        { status: 400 }
      );
    }

    // Prevent double provisioning
    if (status === "APPROVED" && application.organisationId) {
      return NextResponse.json(
        { error: "This application has already been provisioned." },
        { status: 400 }
      );
    }

    // If approving, provision the organisation
    let provisioningResult = null;
    if (status === "APPROVED") {
      provisioningResult = await provisionOrganisationFromApplication(application.id, context);
    }

    // Update application status
    const updatedApplication = await db.organisationApplication.update({
      where: { id },
      data: {
        status,
        reviewNotes: reviewNotes ?? null,
        rejectionReason: status === "REJECTED" ? rejectionReason : null,
        reviewedAt: new Date(),
        reviewedByUserId: context.userId,
        ...(provisioningResult
          ? {
              organisationId: provisioningResult.organisationId,
              invitationId: provisioningResult.invitationId,
            }
          : {}),
      },
      select: {
        id: true,
        companyName: true,
        status: true,
        reviewedAt: true,
        organisationId: true,
        organisation: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    // Audit log
    await createPlatformAuditLog(context, `application.${status.toLowerCase()}`, {
      entityType: "OrganisationApplication",
      entityId: id,
      targetOrgId: updatedApplication.organisationId ?? undefined,
      metadata: {
        companyName: application.companyName,
        previousStatus: application.status,
        newStatus: status,
        reviewNotes,
        rejectionReason: status === "REJECTED" ? rejectionReason : undefined,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return privateJson({
      data: updatedApplication,
      provisioning: provisioningResult,
    });
  } catch (error) {
    return jsonError(error);
  }
}
