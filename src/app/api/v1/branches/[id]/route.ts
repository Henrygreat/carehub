import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { branchUpdateSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/branches/[id]
 * Get detailed branch information
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await resolveTenantContext();
    assertPermission(context.membership, "branches:read");

    const branch = await db.branch.findFirst({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      include: {
        staffAssignments: {
          where: { endDate: null },
          select: {
            id: true,
            isPrimary: true,
            role: true,
            startDate: true,
            staffProfile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                jobTitle: true,
                employmentStatus: true,
              },
            },
          },
          orderBy: [{ isPrimary: "desc" }, { staffProfile: { lastName: "asc" } }],
        },
      },
    });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    return privateJson({
      data: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        status: branch.status,
        addressLine1: branch.addressLine1,
        addressLine2: branch.addressLine2,
        city: branch.city,
        postcode: branch.postcode,
        phone: branch.phone,
        email: branch.email,
        serviceArea: branch.serviceArea,
        cqcLocationId: branch.cqcLocationId,
        isHeadOffice: branch.isHeadOffice,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
        staffAssignments: branch.staffAssignments.map((assignment) => ({
          id: assignment.id,
          isPrimary: assignment.isPrimary,
          role: assignment.role,
          startDate: assignment.startDate,
          staffProfile: assignment.staffProfile,
        })),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * PATCH /api/v1/branches/[id]
 * Update branch details
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const { id } = await params;
    const context = await resolveTenantContext();
    assertPermission(context.membership, "branches:update");

    const branch = await db.branch.findFirst({
      where: {
        id,
        organisationId: context.organisation.id,
      },
    });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    const parsed = branchUpdateSchema.partial().safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.flatten());
    }

    const data = parsed.data;

    // If setting as head office, unset any existing head office
    if (data.isHeadOffice && !branch.isHeadOffice) {
      await db.branch.updateMany({
        where: {
          organisationId: context.organisation.id,
          isHeadOffice: true,
        },
        data: { isHeadOffice: false },
      });
    }

    const updated = await db.$transaction(async (tx) => {
      const updatedBranch = await tx.branch.update({
        where: { id },
        data: {
          name: data.name?.trim(),
          addressLine1: data.addressLine1?.trim(),
          addressLine2: data.addressLine2?.trim(),
          city: data.city?.trim(),
          postcode: data.postcode?.trim(),
          phone: data.phone?.trim(),
          email: data.email?.toLowerCase(),
          serviceArea: data.serviceArea?.trim(),
          cqcLocationId: data.cqcLocationId?.trim(),
          isHeadOffice: data.isHeadOffice,
        },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          isHeadOffice: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "branch.updated",
          entityType: "Branch",
          entityId: id,
          metadata: { fields: Object.keys(data) },
        },
      });

      return updatedBranch;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * POST /api/v1/branches/[id]
 * Perform actions on branch: deactivate, reactivate
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const { id } = await params;
    const context = await resolveTenantContext();

    const body = await request.json();
    const action = body.action;

    if (!action || typeof action !== "string") {
      return validationError({ fieldErrors: { action: ["Action is required"] } });
    }

    const branch = await db.branch.findFirst({
      where: {
        id,
        organisationId: context.organisation.id,
      },
    });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    switch (action) {
      case "deactivate": {
        assertPermission(context.membership, "branches:deactivate");

        if (branch.status === "INACTIVE") {
          return NextResponse.json(
            { error: "Branch is already inactive." },
            { status: 400 },
          );
        }

        if (branch.isHeadOffice) {
          return NextResponse.json(
            { error: "Cannot deactivate the head office branch." },
            { status: 400 },
          );
        }

        const deactivated = await db.$transaction(async (tx) => {
          const updated = await tx.branch.update({
            where: { id },
            data: { status: "INACTIVE" },
            select: { id: true, name: true, code: true, status: true },
          });

          // End all active staff assignments
          await tx.branchAssignment.updateMany({
            where: {
              branchId: id,
              endDate: null,
            },
            data: { endDate: new Date() },
          });

          await tx.auditLog.create({
            data: {
              organisationId: context.organisation.id,
              actorUserId: context.userId,
              actorMembershipId: context.membership.id,
              action: "branch.deactivated",
              entityType: "Branch",
              entityId: id,
              metadata: { name: branch.name },
            },
          });

          return updated;
        });

        return NextResponse.json({ data: deactivated });
      }

      case "reactivate": {
        assertPermission(context.membership, "branches:update");

        if (branch.status !== "INACTIVE") {
          return NextResponse.json(
            { error: "Branch is not inactive." },
            { status: 400 },
          );
        }

        const reactivated = await db.$transaction(async (tx) => {
          const updated = await tx.branch.update({
            where: { id },
            data: { status: "ACTIVE" },
            select: { id: true, name: true, code: true, status: true },
          });

          await tx.auditLog.create({
            data: {
              organisationId: context.organisation.id,
              actorUserId: context.userId,
              actorMembershipId: context.membership.id,
              action: "branch.reactivated",
              entityType: "Branch",
              entityId: id,
              metadata: { name: branch.name },
            },
          });

          return updated;
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
