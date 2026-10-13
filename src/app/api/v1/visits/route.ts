import { Prisma, VisitStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { careVisitSchema } from "@/lib/validation";

const VISITS_PAGE_SIZE = 50;

export async function GET(request: Request) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "visits:read");

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const clientId = searchParams.get("clientId");
    const staffProfileId = searchParams.get("staffProfileId");
    const statusParam = searchParams.get("status");

    // Parse status filter
    let status: VisitStatus | undefined;
    if (statusParam && Object.values(VisitStatus).includes(statusParam as VisitStatus)) {
      status = statusParam as VisitStatus;
    }

    // Build date range
    let dateFilter: Prisma.CareVisitWhereInput["scheduledDate"];
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
    const where: Prisma.CareVisitWhereInput = {
      organisationId: context.organisation.id,
      ...(dateFilter && { scheduledDate: dateFilter }),
      ...(clientId && { clientId }),
      ...(status && { status }),
    };

    // Care workers can only see their own visits
    if (context.membership.role === "CARE_WORKER") {
      const staffProfile = await db.staffProfile.findFirst({
        where: {
          membershipUserId: context.userId,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });
      if (staffProfile) {
        where.staffProfileId = staffProfile.id;
      } else {
        // No staff profile, return empty
        return privateJson({ data: [], pagination: { total: 0 } });
      }
    } else if (staffProfileId) {
      where.staffProfileId = staffProfileId;
    }

    const [total, data] = await db.$transaction([
      db.careVisit.count({ where }),
      db.careVisit.findMany({
        where,
        select: {
          id: true,
          scheduledDate: true,
          scheduledStart: true,
          scheduledEnd: true,
          actualStart: true,
          actualEnd: true,
          status: true,
          visitType: true,
          notes: true,
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              addressLine1: true,
              postcode: true,
            },
          },
          staffProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ scheduledDate: "asc" }, { scheduledStart: "asc" }],
        take: VISITS_PAGE_SIZE,
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
    assertPermission(context.membership, "visits:create");

    const parsed = careVisitSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    // Validate client belongs to org
    const client = await db.client.findUnique({
      where: {
        id: input.clientId,
        organisationId: context.organisation.id,
      },
      select: { id: true, status: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    if (client.status === "ARCHIVED") {
      return NextResponse.json({ error: "Cannot create visits for archived clients." }, { status: 400 });
    }

    // Validate staff profile if provided
    if (input.staffProfileId) {
      const staffProfile = await db.staffProfile.findUnique({
        where: {
          id: input.staffProfileId,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });

      if (!staffProfile) {
        return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
      }
    }

    // Parse time strings to Date objects (using a reference date)
    const referenceDate = new Date("1970-01-01");
    const [startHour, startMin] = input.scheduledStart.split(":").map(Number);
    const [endHour, endMin] = input.scheduledEnd.split(":").map(Number);

    const scheduledStartTime = new Date(referenceDate);
    scheduledStartTime.setUTCHours(startHour, startMin, 0, 0);

    const scheduledEndTime = new Date(referenceDate);
    scheduledEndTime.setUTCHours(endHour, endMin, 0, 0);

    const visit = await db.$transaction(async (transaction) => {
      const created = await transaction.careVisit.create({
        data: {
          organisationId: context.organisation.id,
          clientId: input.clientId,
          staffProfileId: input.staffProfileId ?? null,
          scheduledDate: input.scheduledDate,
          scheduledStart: scheduledStartTime,
          scheduledEnd: scheduledEndTime,
          visitType: input.visitType ?? null,
          notes: input.notes ?? null,
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "visit.created",
          entityType: "CareVisit",
          entityId: created.id,
          metadata: { clientId: input.clientId },
        },
      });

      return created;
    });

    return NextResponse.json({ data: visit }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
