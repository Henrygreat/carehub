import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { staffAbsenceSchema } from "@/lib/validation";
import { parseTimeString } from "@/lib/scheduling";
import { notifyLeaveRequest, getCoordinatorMembershipIds } from "@/lib/notifications";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "absence:read");

    const { id: staffProfileId } = await params;
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const includeHistory = searchParams.get("includeHistory") === "true";

    // Verify staff profile belongs to org
    const staffProfile = await db.staffProfile.findUnique({
      where: {
        id: staffProfileId,
        organisationId: context.organisation.id,
      },
      select: { id: true, membershipUserId: true, firstName: true, lastName: true },
    });

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
    }

    // Care workers can only view their own absences
    if (
      context.membership.role === "CARE_WORKER" &&
      staffProfile.membershipUserId !== context.userId
    ) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: Record<string, unknown> = {
      staffProfileId,
      organisationId: context.organisation.id,
    };

    if (statusParam) {
      where.status = statusParam;
    }

    if (!includeHistory) {
      // Only show current and future absences by default
      where.endDate = { gte: today };
    }

    const absences = await db.staffAbsence.findMany({
      where,
      include: {
        reviewedBy: {
          select: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: [{ startDate: "asc" }],
    });

    return privateJson({
      data: absences.map((a) => ({
        ...a,
        startTimeStr: a.startTime?.toTimeString().slice(0, 5) ?? null,
        endTimeStr: a.endTime?.toTimeString().slice(0, 5) ?? null,
        reviewedByName: a.reviewedBy?.user.name ?? null,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "absence:request");

    const { id: staffProfileId } = await params;

    // Verify staff profile belongs to org
    const staffProfile = await db.staffProfile.findUnique({
      where: {
        id: staffProfileId,
        organisationId: context.organisation.id,
      },
      select: { id: true, membershipUserId: true, firstName: true, lastName: true },
    });

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
    }

    // Care workers can only request their own absences
    if (
      context.membership.role === "CARE_WORKER" &&
      staffProfile.membershipUserId !== context.userId
    ) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const parsed = staffAbsenceSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    // Validate dates
    if (input.endDate < input.startDate) {
      return NextResponse.json({ error: "End date must be after start date." }, { status: 400 });
    }

    // Check for overlapping absences
    const overlapping = await db.staffAbsence.findFirst({
      where: {
        staffProfileId,
        status: { in: ["PENDING", "APPROVED"] },
        OR: [
          {
            startDate: { lte: input.endDate },
            endDate: { gte: input.startDate },
          },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json({
        error: "There is already an absence request for this period.",
      }, { status: 400 });
    }

    const absence = await db.$transaction(async (transaction) => {
      const created = await transaction.staffAbsence.create({
        data: {
          organisationId: context.organisation.id,
          staffProfileId,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          startTime: input.startTime ? parseTimeString(input.startTime) : null,
          endTime: input.endTime ? parseTimeString(input.endTime) : null,
          isFullDay: input.isFullDay,
          reason: input.reason ?? null,
          notes: input.notes ?? null,
        },
      });

      // Audit log
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "absence.requested",
          entityType: "StaffAbsence",
          entityId: created.id,
          metadata: {
            type: input.type,
            startDate: input.startDate.toISOString(),
            endDate: input.endDate.toISOString(),
          },
        },
      });

      return created;
    });

    // Notify coordinators
    const coordinatorIds = await getCoordinatorMembershipIds(context.organisation.id);
    const dateRange = `${input.startDate.toLocaleDateString("en-GB")} - ${input.endDate.toLocaleDateString("en-GB")}`;
    await notifyLeaveRequest(
      context.organisation.id,
      coordinatorIds,
      absence.id,
      `${staffProfile.firstName} ${staffProfile.lastName}`,
      dateRange,
      input.type,
    );

    return NextResponse.json({ data: absence }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
