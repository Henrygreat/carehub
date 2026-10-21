import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { branchSchema } from "@/lib/validation";

/**
 * GET /api/v1/branches
 * List all branches for the current organisation
 */
export async function GET(request: Request) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "branches:read");

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const includeStats = url.searchParams.get("includeStats") === "true";

    const branches = await db.branch.findMany({
      where: {
        organisationId: context.organisation.id,
        ...(status ? { status: status as "ACTIVE" | "INACTIVE" } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        addressLine1: true,
        city: true,
        postcode: true,
        phone: true,
        email: true,
        serviceArea: true,
        cqcLocationId: true,
        isHeadOffice: true,
        createdAt: true,
        updatedAt: true,
        ...(includeStats
          ? {
              _count: {
                select: {
                  staffAssignments: {
                    where: { endDate: null },
                  },
                },
              },
            }
          : {}),
      },
      orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }],
    });

    return privateJson({
      data: branches.map((branch) => ({
        ...branch,
        ...(includeStats
          ? {
              activeStaff: (branch as { _count?: { staffAssignments: number } })._count
                ?.staffAssignments,
            }
          : {}),
        _count: undefined,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * POST /api/v1/branches
 * Create a new branch
 */
export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "branches:create");

    const parsed = branchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.flatten());
    }

    const data = parsed.data;

    // Check for duplicate code
    const existingBranch = await db.branch.findUnique({
      where: {
        organisationId_code: {
          organisationId: context.organisation.id,
          code: data.code.toUpperCase(),
        },
      },
    });

    if (existingBranch) {
      return NextResponse.json(
        { error: "A branch with this code already exists." },
        { status: 409 },
      );
    }

    // If setting as head office, unset any existing head office
    if (data.isHeadOffice) {
      await db.branch.updateMany({
        where: {
          organisationId: context.organisation.id,
          isHeadOffice: true,
        },
        data: { isHeadOffice: false },
      });
    }

    const branch = await db.$transaction(async (tx) => {
      const newBranch = await tx.branch.create({
        data: {
          organisationId: context.organisation.id,
          name: data.name.trim(),
          code: data.code.toUpperCase(),
          status: "ACTIVE",
          addressLine1: data.addressLine1?.trim() || null,
          addressLine2: data.addressLine2?.trim() || null,
          city: data.city?.trim() || null,
          postcode: data.postcode?.trim() || null,
          phone: data.phone?.trim() || null,
          email: data.email?.toLowerCase() || null,
          serviceArea: data.serviceArea?.trim() || null,
          cqcLocationId: data.cqcLocationId?.trim() || null,
          isHeadOffice: data.isHeadOffice ?? false,
        },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          isHeadOffice: true,
        },
      });

      await tx.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "branch.created",
          entityType: "Branch",
          entityId: newBranch.id,
          metadata: { name: newBranch.name, code: newBranch.code },
        },
      });

      return newBranch;
    });

    return NextResponse.json({ data: branch }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
