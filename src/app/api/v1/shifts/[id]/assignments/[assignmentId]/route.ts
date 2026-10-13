import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "shifts:update");

    const { id, assignmentId } = await params;

    await db.$transaction(async (transaction) => {
      const shift = await transaction.shift.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: { id: true, status: true, locationName: true },
      });

      if (!shift) {
        throw new Error("SHIFT_NOT_FOUND");
      }

      if (shift.status === "CANCELLED") {
        throw new Error("CANCELLED_SHIFT");
      }

      if (shift.status === "COMPLETED") {
        throw new Error("COMPLETED_SHIFT");
      }

      const assignment = await transaction.shiftAssignment.findUnique({
        where: {
          id: assignmentId,
          shiftId: id,
        },
        select: {
          id: true,
          staffProfile: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      if (!assignment) {
        throw new Error("ASSIGNMENT_NOT_FOUND");
      }

      await transaction.shiftAssignment.delete({
        where: { id: assignmentId },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "shift.staff_unassigned",
          entityType: "ShiftAssignment",
          entityId: assignmentId,
          metadata: {
            shiftId: id,
            staffName: `${assignment.staffProfile.firstName} ${assignment.staffProfile.lastName}`,
          },
        },
      });
    });

    return privateJson({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SHIFT_NOT_FOUND") {
        return NextResponse.json({ error: "Shift not found." }, { status: 404 });
      }
      if (error.message === "CANCELLED_SHIFT") {
        return NextResponse.json({ error: "Cannot modify a cancelled shift." }, { status: 400 });
      }
      if (error.message === "COMPLETED_SHIFT") {
        return NextResponse.json({ error: "Cannot modify a completed shift." }, { status: 400 });
      }
      if (error.message === "ASSIGNMENT_NOT_FOUND") {
        return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
      }
    }
    return jsonError(error);
  }
}
