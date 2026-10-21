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
import { organisationExtendedSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/platform-admin/organisations/[id]
 * Get detailed organisation information (platform admin only)
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await resolvePlatformAdminContext();
    assertPlatformPermission(context.user, "platform:organisations:read");

    const organisation = await db.organisation.findUnique({
      where: { id },
      include: {
        branches: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            isHeadOffice: true,
            city: true,
          },
          orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }],
        },
        _count: {
          select: {
            memberships: { where: { active: true } },
            staffProfiles: { where: { employmentStatus: "ACTIVE" } },
            clients: { where: { status: "ACTIVE" } },
          },
        },
      },
    });

    if (!organisation) {
      return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
    }

    return privateJson({
      data: {
        id: organisation.id,
        name: organisation.name,
        slug: organisation.slug,
        brandName: organisation.brandName,
        brandColour: organisation.brandColour,
        status: organisation.status,
        tradingName: organisation.tradingName,
        companyRegistrationNo: organisation.companyRegistrationNo,
        contactEmail: organisation.contactEmail,
        contactPhone: organisation.contactPhone,
        registeredAddressLine1: organisation.registeredAddressLine1,
        registeredAddressLine2: organisation.registeredAddressLine2,
        registeredCity: organisation.registeredCity,
        registeredPostcode: organisation.registeredPostcode,
        registeredCountry: organisation.registeredCountry,
        operatingAddressLine1: organisation.operatingAddressLine1,
        operatingAddressLine2: organisation.operatingAddressLine2,
        operatingCity: organisation.operatingCity,
        operatingPostcode: organisation.operatingPostcode,
        operatingCountry: organisation.operatingCountry,
        cqcProviderId: organisation.cqcProviderId,
        cqcProviderName: organisation.cqcProviderName,
        cqcRegisteredManager: organisation.cqcRegisteredManager,
        timezone: organisation.timezone,
        createdAt: organisation.createdAt,
        updatedAt: organisation.updatedAt,
        suspendedAt: organisation.suspendedAt,
        branches: organisation.branches,
        stats: {
          activeUsers: organisation._count.memberships,
          activeStaff: organisation._count.staffProfiles,
          activeClients: organisation._count.clients,
        },
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * PATCH /api/v1/platform-admin/organisations/[id]
 * Update organisation details (platform admin only)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const { id } = await params;
    const context = await resolvePlatformAdminContext();
    assertPlatformPermission(context.user, "platform:organisations:update");

    const existing = await db.organisation.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
    }

    const parsed = organisationExtendedSchema.partial().safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.flatten());
    }

    const updated = await db.organisation.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        updatedAt: true,
      },
    });

    await createPlatformAuditLog(context, "organisation.updated", {
      entityType: "Organisation",
      entityId: id,
      targetOrgId: id,
      metadata: { fields: Object.keys(parsed.data) },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * POST /api/v1/platform-admin/organisations/[id]
 * Perform actions on organisation: suspend, reactivate (platform admin only)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const { id } = await params;
    const context = await resolvePlatformAdminContext();

    const body = await request.json();
    const action = body.action;

    if (!action || typeof action !== "string") {
      return validationError({ fieldErrors: { action: ["Action is required"] } });
    }

    const organisation = await db.organisation.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });

    if (!organisation) {
      return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
    }

    switch (action) {
      case "suspend": {
        assertPlatformPermission(context.user, "platform:organisations:suspend");

        if (organisation.status === "SUSPENDED") {
          return NextResponse.json(
            { error: "Organisation is already suspended." },
            { status: 400 },
          );
        }

        const reason = body.reason?.trim();
        if (!reason || reason.length < 5) {
          return validationError({
            fieldErrors: { reason: ["Suspension reason is required (min 5 characters)"] },
          });
        }

        const suspended = await db.$transaction(async (tx) => {
          // Suspend the organisation
          const org = await tx.organisation.update({
            where: { id },
            data: {
              status: "SUSPENDED",
              suspendedAt: new Date(),
            },
            select: { id: true, name: true, status: true, suspendedAt: true },
          });

          // Invalidate all user sessions by incrementing sessionVersion
          await tx.user.updateMany({
            where: {
              memberships: {
                some: { organisationId: id, active: true },
              },
            },
            data: { sessionVersion: { increment: 1 } },
          });

          return org;
        });

        await createPlatformAuditLog(context, "organisation.suspended", {
          entityType: "Organisation",
          entityId: id,
          targetOrgId: id,
          metadata: { reason, previousStatus: organisation.status },
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        });

        return NextResponse.json({ data: suspended });
      }

      case "reactivate": {
        assertPlatformPermission(context.user, "platform:organisations:reactivate");

        if (organisation.status !== "SUSPENDED") {
          return NextResponse.json(
            { error: "Organisation is not suspended." },
            { status: 400 },
          );
        }

        const reactivated = await db.organisation.update({
          where: { id },
          data: {
            status: "ACTIVE",
            suspendedAt: null,
          },
          select: { id: true, name: true, status: true },
        });

        await createPlatformAuditLog(context, "organisation.reactivated", {
          entityType: "Organisation",
          entityId: id,
          targetOrgId: id,
          metadata: {},
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        });

        return NextResponse.json({ data: reactivated });
      }

      default:
        return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }
  } catch (error) {
    return jsonError(error);
  }
}
