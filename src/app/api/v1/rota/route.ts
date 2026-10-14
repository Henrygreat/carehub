import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { rotaQuerySchema, visitRescheduleSchema } from "@/lib/validation";
import { checkSchedulingConflicts, parseTimeString } from "@/lib/scheduling";
import { notifyAssignmentChanged, notifyNewAssignment } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "rota:read");

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: "startDate and endDate are required." }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
    }

    const staffProfileId = searchParams.get("staffProfileId");
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");
    const unassignedOnly = searchParams.get("unassignedOnly") === "true";

    // Build where clause
    const where: Record<string, unknown> = {
      organisationId: context.organisation.id,
      scheduledDate: { gte: startDate, lte: endDate },
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
        return privateJson({ data: { visits: [], shifts: [], absences: [] } });
      }
    } else {
      if (staffProfileId) where.staffProfileId = staffProfileId;
      if (unassignedOnly) where.staffProfileId = null;
    }

    if (clientId) where.clientId = clientId;
    if (status) where.status = status;

    // Fetch visits
    const visits = await db.careVisit.findMany({
      where: {
        ...where,
        status: status ? (status as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "MISSED" | "CANCELLED") : { not: "CANCELLED" },
      },
      select: {
        id: true,
        scheduledDate: true,
        scheduledStart: true,
        scheduledEnd: true,
        status: true,
        visitType: true,
        notes: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            clientReference: true,
            postcode: true,
          },
        },
        staffProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        recurrence: {
          select: { id: true, frequency: true },
        },
      },
      orderBy: [{ scheduledDate: "asc" }, { scheduledStart: "asc" }],
    });

    // Fetch shifts (for managers/coordinators)
    let shifts: Array<{
      id: string;
      scheduledDate: Date;
      scheduledStart: Date;
      scheduledEnd: Date;
      status: string;
      locationName: string;
      assignments: Array<{
        id: string;
        staffProfile: { id: string; firstName: string; lastName: string };
      }>;
    }> = [];

    if (context.membership.role !== "CARE_WORKER") {
      shifts = await db.shift.findMany({
        where: {
          organisationId: context.organisation.id,
          scheduledDate: { gte: startDate, lte: endDate },
          status: { not: "CANCELLED" },
        },
        select: {
          id: true,
          scheduledDate: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
          locationName: true,
          assignments: {
            select: {
              id: true,
              staffProfile: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: [{ scheduledDate: "asc" }, { scheduledStart: "asc" }],
      });
    }

    // Fetch absences
    const absenceWhere: Record<string, unknown> = {
      organisationId: context.organisation.id,
      status: "APPROVED",
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    };

    if (context.membership.role === "CARE_WORKER") {
      const staffProfile = await db.staffProfile.findFirst({
        where: {
          membershipUserId: context.userId,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });
      if (staffProfile) {
        absenceWhere.staffProfileId = staffProfile.id;
      }
    } else if (staffProfileId) {
      absenceWhere.staffProfileId = staffProfileId;
    }

    const absences = await db.staffAbsence.findMany({
      where: absenceWhere,
      select: {
        id: true,
        staffProfileId: true,
        type: true,
        startDate: true,
        endDate: true,
        isFullDay: true,
        staffProfile: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    return privateJson({
      data: {
        visits: visits.map((v) => ({
          ...v,
          scheduledStartStr: v.scheduledStart.toTimeString().slice(0, 5),
          scheduledEndStr: v.scheduledEnd.toTimeString().slice(0, 5),
        })),
        shifts: shifts.map((s) => ({
          ...s,
          scheduledStartStr: s.scheduledStart.toTimeString().slice(0, 5),
          scheduledEndStr: s.scheduledEnd.toTimeString().slice(0, 5),
        })),
        absences,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

// Reschedule a visit (drag-drop)
export async function PUT(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "rota:manage");

    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get("visitId");

    if (!visitId) {
      return NextResponse.json({ error: "visitId is required." }, { status: 400 });
    }

    const visit = await db.careVisit.findUnique({
      where: {
        id: visitId,
        organisationId: context.organisation.id,
      },
      include: {
        client: { select: { firstName: true, lastName: true } },
        staffProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            membershipUserId: true,
          },
        },
      },
    });

    if (!visit) {
      return NextResponse.json({ error: "Visit not found." }, { status: 404 });
    }

    if (visit.status === "COMPLETED" || visit.status === "CANCELLED") {
      return NextResponse.json({ error: "Cannot reschedule completed or cancelled visits." }, { status: 400 });
    }

    const parsed = visitRescheduleSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const { scheduledDate, scheduledStart, scheduledEnd, staffProfileId, overrideConflicts, overrideReason } = parsed.data;

    const newStartTime = parseTimeString(scheduledStart);
    const newEndTime = parseTimeString(scheduledEnd);

    // Check for conflicts if assigning to staff
    const assignedStaffId = staffProfileId ?? visit.staffProfileId;
    let conflicts: Awaited<ReturnType<typeof checkSchedulingConflicts>> = [];

    if (assignedStaffId) {
      conflicts = await checkSchedulingConflicts(
        context.organisation.id,
        assignedStaffId,
        scheduledDate,
        newStartTime,
        newEndTime,
        visitId,
      );

      const hasErrors = conflicts.some((c) => c.severity === "error");
      if (hasErrors && !overrideConflicts) {
        return NextResponse.json({
          error: "Scheduling conflicts detected.",
          conflicts,
        }, { status: 409 });
      }
    }

    // Perform the update
    const updated = await db.$transaction(async (transaction) => {
      const result = await transaction.careVisit.update({
        where: { id: visitId },
        data: {
          scheduledDate,
          scheduledStart: newStartTime,
          scheduledEnd: newEndTime,
          staffProfileId: staffProfileId ?? visit.staffProfileId,
        },
      });

      // Record override if conflicts were bypassed
      if (overrideConflicts && conflicts.length > 0 && assignedStaffId) {
        for (const conflict of conflicts.filter((c) => c.severity === "error")) {
          await transaction.schedulingOverride.create({
            data: {
              organisationId: context.organisation.id,
              visitId,
              staffProfileId: assignedStaffId,
              conflictType: conflict.type,
              conflictDetails: conflict.details as Prisma.InputJsonValue,
              reason: overrideReason ?? "Override approved",
              approvedById: context.membership.id,
            },
          });
        }
      }

      // Audit log
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "visit.rescheduled",
          entityType: "CareVisit",
          entityId: visitId,
          metadata: {
            previousDate: visit.scheduledDate.toISOString(),
            newDate: scheduledDate.toISOString(),
            previousStart: visit.scheduledStart.toTimeString().slice(0, 5),
            newStart: scheduledStart,
            staffChanged: staffProfileId && staffProfileId !== visit.staffProfileId,
            overrideApplied: overrideConflicts && conflicts.length > 0,
          },
        },
      });

      return result;
    });

    // Send notifications
    const dateStr = scheduledDate.toLocaleDateString("en-GB");
    const clientName = `${visit.client.firstName} ${visit.client.lastName}`;

    // If staff changed
    if (staffProfileId && staffProfileId !== visit.staffProfileId) {
      // Notify new staff
      const newStaff = await db.staffProfile.findUnique({
        where: { id: staffProfileId },
        select: { membershipUserId: true },
      });
      if (newStaff?.membershipUserId) {
        const membership = await db.membership.findUnique({
          where: {
            userId_organisationId: {
              userId: newStaff.membershipUserId,
              organisationId: context.organisation.id,
            },
          },
          select: { id: true },
        });
        if (membership) {
          await notifyNewAssignment(
            context.organisation.id,
            membership.id,
            visitId,
            clientName,
            dateStr,
            scheduledStart,
          );
        }
      }
    } else if (visit.staffProfile?.membershipUserId) {
      // Notify existing staff of change
      const membership = await db.membership.findUnique({
        where: {
          userId_organisationId: {
            userId: visit.staffProfile.membershipUserId,
            organisationId: context.organisation.id,
          },
        },
        select: { id: true },
      });
      if (membership) {
        await notifyAssignmentChanged(
          context.organisation.id,
          membership.id,
          visitId,
          clientName,
          `Rescheduled to ${dateStr} at ${scheduledStart}`,
        );
      }
    }

    return privateJson({
      data: {
        ...updated,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
