import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { absenceReviewSchema } from "@/lib/validation";
import { notifyLeaveDecision } from "@/lib/notifications";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "absence:read");

    const { id } = await params;

    const absence = await db.staffAbsence.findUnique({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      include: {
        staffProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            membershipUserId: true,
          },
        },
        reviewedBy: {
          select: {
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!absence) {
      return NextResponse.json({ error: "Absence not found." }, { status: 404 });
    }

    // Care workers can only view their own absences
    if (
      context.membership.role === "CARE_WORKER" &&
      absence.staffProfile.membershipUserId !== context.userId
    ) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    return privateJson({
      data: {
        ...absence,
        startTimeStr: absence.startTime?.toTimeString().slice(0, 5) ?? null,
        endTimeStr: absence.endTime?.toTimeString().slice(0, 5) ?? null,
        reviewedByName: absence.reviewedBy?.user.name ?? null,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "absence:approve");

    const { id } = await params;

    const absence = await db.staffAbsence.findUnique({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      include: {
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

    if (!absence) {
      return NextResponse.json({ error: "Absence not found." }, { status: 404 });
    }

    if (absence.status !== "PENDING") {
      return NextResponse.json({
        error: "Only pending absences can be reviewed.",
      }, { status: 400 });
    }

    const parsed = absenceReviewSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const { status, reviewNotes } = parsed.data;

    const updated = await db.$transaction(async (transaction) => {
      const result = await transaction.staffAbsence.update({
        where: { id },
        data: {
          status,
          reviewedById: context.membership.id,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes ?? null,
        },
      });

      // Audit log
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: status === "APPROVED" ? "absence.approved" : "absence.rejected",
          entityType: "StaffAbsence",
          entityId: id,
          metadata: {
            staffProfileId: absence.staffProfileId,
            type: absence.type,
            startDate: absence.startDate.toISOString(),
            endDate: absence.endDate.toISOString(),
          },
        },
      });

      return result;
    });

    // Notify the staff member
    if (absence.staffProfile.membershipUserId) {
      const staffMembership = await db.membership.findUnique({
        where: {
          userId_organisationId: {
            userId: absence.staffProfile.membershipUserId,
            organisationId: context.organisation.id,
          },
        },
        select: { id: true },
      });

      if (staffMembership) {
        const dateRange = `${absence.startDate.toLocaleDateString("en-GB")} - ${absence.endDate.toLocaleDateString("en-GB")}`;
        await notifyLeaveDecision(
          context.organisation.id,
          staffMembership.id,
          absence.id,
          status === "APPROVED",
          dateRange,
        );
      }
    }

    return privateJson({ data: updated });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "absence:request");

    const { id } = await params;

    const absence = await db.staffAbsence.findUnique({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      include: {
        staffProfile: {
          select: { membershipUserId: true },
        },
      },
    });

    if (!absence) {
      return NextResponse.json({ error: "Absence not found." }, { status: 404 });
    }

    // Only the staff member or managers can cancel
    const isOwnAbsence = absence.staffProfile.membershipUserId === context.userId;
    if (!isOwnAbsence && context.membership.role === "CARE_WORKER") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // Only pending absences can be cancelled by staff, approved can be cancelled by managers
    if (absence.status === "PENDING" || (absence.status === "APPROVED" && !isOwnAbsence)) {
      await db.$transaction(async (transaction) => {
        await transaction.staffAbsence.update({
          where: { id },
          data: { status: "CANCELLED" },
        });

        await transaction.auditLog.create({
          data: {
            organisationId: context.organisation.id,
            actorUserId: context.userId,
            actorMembershipId: context.membership.id,
            action: "absence.cancelled",
            entityType: "StaffAbsence",
            entityId: id,
          },
        });
      });

      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({
      error: "This absence cannot be cancelled.",
    }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
