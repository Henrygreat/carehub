import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { shiftAssignmentSchema } from "@/lib/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "shifts:read");

    const { id } = await params;

    const shift = await db.shift.findUnique({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      select: { id: true },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    const assignments = await db.shiftAssignment.findMany({
      where: { shiftId: id },
      select: {
        id: true,
        staffProfileId: true,
        actualStart: true,
        actualEnd: true,
        status: true,
        notes: true,
        createdAt: true,
        staffProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return privateJson({ data: assignments });
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
    assertPermission(context.membership, "shifts:update");

    const { id } = await params;
    const parsed = shiftAssignmentSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const { staffProfileId } = parsed.data;

    const assignment = await db.$transaction(async (transaction) => {
      const shift = await transaction.shift.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: { id: true, status: true, locationName: true },
      });

      if (!shift) {
        throw new Error("NOT_FOUND");
      }

      if (shift.status === "CANCELLED") {
        throw new Error("CANCELLED_SHIFT");
      }

      if (shift.status === "COMPLETED") {
        throw new Error("COMPLETED_SHIFT");
      }

      // Validate staff profile
      const staffProfile = await transaction.staffProfile.findUnique({
        where: {
          id: staffProfileId,
          organisationId: context.organisation.id,
        },
        select: { id: true, firstName: true, lastName: true },
      });

      if (!staffProfile) {
        throw new Error("STAFF_NOT_FOUND");
      }

      // Check for existing assignment
      const existingAssignment = await transaction.shiftAssignment.findUnique({
        where: {
          shiftId_staffProfileId: {
            shiftId: id,
            staffProfileId,
          },
        },
      });

      if (existingAssignment) {
        throw new Error("ALREADY_ASSIGNED");
      }

      const created = await transaction.shiftAssignment.create({
        data: {
          shiftId: id,
          organisationId: context.organisation.id,
          staffProfileId,
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "shift.staff_assigned",
          entityType: "ShiftAssignment",
          entityId: created.id,
          metadata: {
            shiftId: id,
            staffProfileId,
            staffName: `${staffProfile.firstName} ${staffProfile.lastName}`,
          },
        },
      });

      return created;
    });

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Shift not found." }, { status: 404 });
      }
      if (error.message === "CANCELLED_SHIFT") {
        return NextResponse.json({ error: "Cannot assign staff to a cancelled shift." }, { status: 400 });
      }
      if (error.message === "COMPLETED_SHIFT") {
        return NextResponse.json({ error: "Cannot assign staff to a completed shift." }, { status: 400 });
      }
      if (error.message === "STAFF_NOT_FOUND") {
        return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
      }
      if (error.message === "ALREADY_ASSIGNED") {
        return NextResponse.json({ error: "Staff member is already assigned to this shift." }, { status: 400 });
      }
    }
    return jsonError(error);
  }
}
