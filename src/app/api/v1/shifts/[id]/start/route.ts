import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission, canAccessShift } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { attendanceStartSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "attendance:record");

    const { id } = await params;
    const body = await request.json();
    const parsed = attendanceStartSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten());

    const actualStart = parsed.data.actualStart ?? new Date();

    // Look up staff profile for care workers
    let staffProfileId: string | null = null;
    if (context.membership.role === "CARE_WORKER") {
      const staffProfile = await db.staffProfile.findFirst({
        where: {
          membershipUserId: context.userId,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });
      staffProfileId = staffProfile?.id ?? null;
    }

    const updatedShift = await db.$transaction(async (transaction) => {
      const shift = await transaction.shift.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: {
          id: true,
          status: true,
          locationName: true,
          assignments: {
            select: { id: true, staffProfileId: true, status: true },
          },
        },
      });

      if (!shift) {
        throw new Error("NOT_FOUND");
      }

      // For care workers, verify they are assigned to this shift
      const isAssigned = shift.assignments.some((a) => a.staffProfileId === staffProfileId);
      const accessContext = { membership: context.membership, staffProfileId };
      if (!canAccessShift(accessContext, isAssigned)) {
        throw new Error("NOT_AUTHORIZED");
      }

      if (shift.status === "CANCELLED") {
        throw new Error("CANCELLED_SHIFT");
      }

      // Update shift status to IN_PROGRESS if still SCHEDULED
      if (shift.status === "SCHEDULED") {
        await transaction.shift.update({
          where: { id },
          data: { status: "IN_PROGRESS" },
        });
      }

      // Update the assignment for this staff member
      if (staffProfileId) {
        const assignment = shift.assignments.find((a) => a.staffProfileId === staffProfileId);
        if (assignment && assignment.status === "SCHEDULED") {
          await transaction.shiftAssignment.update({
            where: { id: assignment.id },
            data: {
              status: "IN_PROGRESS",
              actualStart,
            },
          });
        }
      }

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "shift.started",
          entityType: "Shift",
          entityId: id,
          metadata: { locationName: shift.locationName, actualStart: actualStart.toISOString() },
        },
      });

      return transaction.shift.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          assignments: {
            select: {
              id: true,
              status: true,
              actualStart: true,
              staffProfile: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      });
    });

    return privateJson({ data: updatedShift });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Shift not found." }, { status: 404 });
      }
      if (error.message === "NOT_AUTHORIZED") {
        return NextResponse.json({ error: "You are not assigned to this shift." }, { status: 403 });
      }
      if (error.message === "CANCELLED_SHIFT") {
        return NextResponse.json({ error: "Cannot start a cancelled shift." }, { status: 400 });
      }
    }
    return jsonError(error);
  }
}
