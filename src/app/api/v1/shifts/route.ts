import { Prisma, ShiftStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { shiftSchema } from "@/lib/validation";

const SHIFTS_PAGE_SIZE = 50;

export async function GET(request: Request) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "shifts:read");

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const staffProfileId = searchParams.get("staffProfileId");
    const statusParam = searchParams.get("status");

    // Parse status filter
    let status: ShiftStatus | undefined;
    if (statusParam && Object.values(ShiftStatus).includes(statusParam as ShiftStatus)) {
      status = statusParam as ShiftStatus;
    }

    // Build date range
    let dateFilter: Prisma.ShiftWhereInput["scheduledDate"];
    if (dateParam) {
      dateFilter = new Date(dateParam);
    } else if (startDateParam && endDateParam) {
      dateFilter = {
        gte: new Date(startDateParam),
        lte: new Date(endDateParam),
      };
    } else if (startDateParam) {
      dateFilter = { gte: new Date(startDateParam) };
    } else if (endDateParam) {
      dateFilter = { lte: new Date(endDateParam) };
    }

    // Build where clause
    const where: Prisma.ShiftWhereInput = {
      organisationId: context.organisation.id,
      ...(dateFilter && { scheduledDate: dateFilter }),
      ...(status && { status }),
    };

    // Care workers can only see shifts they are assigned to
    if (context.membership.role === "CARE_WORKER") {
      const staffProfile = await db.staffProfile.findFirst({
        where: {
          membershipUserId: context.userId,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });
      if (staffProfile) {
        where.assignments = {
          some: { staffProfileId: staffProfile.id },
        };
      } else {
        // No staff profile, return empty
        return privateJson({ data: [], pagination: { total: 0 } });
      }
    } else if (staffProfileId) {
      where.assignments = {
        some: { staffProfileId },
      };
    }

    const [total, data] = await db.$transaction([
      db.shift.count({ where }),
      db.shift.findMany({
        where,
        select: {
          id: true,
          shiftReference: true,
          locationName: true,
          locationAddress: true,
          scheduledDate: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
          isOvernight: true,
          notes: true,
          assignments: {
            select: {
              id: true,
              status: true,
              actualStart: true,
              actualEnd: true,
              staffProfile: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: [{ scheduledDate: "asc" }, { scheduledStart: "asc" }],
        take: SHIFTS_PAGE_SIZE,
      }),
    ]);

    return privateJson({
      data,
      pagination: { total },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "shifts:create");

    const body = await request.json();
    const parsed = shiftSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    // Validate staff profiles if provided
    if (input.staffProfileIds && input.staffProfileIds.length > 0) {
      const staffProfiles = await db.staffProfile.findMany({
        where: {
          id: { in: input.staffProfileIds },
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });

      if (staffProfiles.length !== input.staffProfileIds.length) {
        return NextResponse.json({ error: "One or more staff members not found." }, { status: 404 });
      }
    }

    // Generate shift reference if not provided with proper prefix
    const shiftReference = input.shiftReference || `SH-${Date.now().toString(36).toUpperCase()}`;

    const shift = await db.$transaction(async (transaction) => {
      const created = await transaction.shift.create({
        data: {
          organisationId: context.organisation.id,
          shiftReference,
          locationName: input.locationName,
          locationAddress: input.locationAddress ?? null,
          scheduledDate: input.scheduledDate,
          scheduledStart: new Date(input.scheduledStart),
          scheduledEnd: new Date(input.scheduledEnd),
          notes: input.notes ?? null,
          isOvernight: input.isOvernight,
        },
      });

      // Create assignments if staff profiles provided
      if (input.staffProfileIds && input.staffProfileIds.length > 0) {
        await transaction.shiftAssignment.createMany({
          data: input.staffProfileIds.map((staffProfileId) => ({
            shiftId: created.id,
            organisationId: context.organisation.id,
            staffProfileId,
          })),
        });
      }

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "shift.created",
          entityType: "Shift",
          entityId: created.id,
          metadata: {
            locationName: input.locationName,
            staffCount: input.staffProfileIds?.length ?? 0,
          },
        },
      });

      return created;
    });

    return NextResponse.json({ data: shift }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
