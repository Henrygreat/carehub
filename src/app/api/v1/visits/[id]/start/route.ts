import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission, canRecordAttendance } from "@/lib/permissions";
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

    const updatedVisit = await db.$transaction(async (transaction) => {
      const existing = await transaction.careVisit.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: {
          id: true,
          status: true,
          clientId: true,
          staffProfileId: true,
        },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      // Verify care worker can record for this visit
      const accessContext = { membership: context.membership, staffProfileId };
      if (!canRecordAttendance(accessContext, existing)) {
        throw new Error("NOT_AUTHORIZED");
      }

      if (existing.status === "CANCELLED") {
        throw new Error("CANCELLED_VISIT");
      }

      if (existing.status === "IN_PROGRESS" || existing.status === "COMPLETED") {
        throw new Error("ALREADY_STARTED");
      }

      const updated = await transaction.careVisit.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          actualStart,
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "visit.started",
          entityType: "CareVisit",
          entityId: id,
          metadata: { clientId: existing.clientId, actualStart: actualStart.toISOString() },
        },
      });

      return updated;
    });

    return privateJson({ data: updatedVisit });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Visit not found." }, { status: 404 });
      }
      if (error.message === "NOT_AUTHORIZED") {
        return NextResponse.json({ error: "You are not authorized to record attendance for this visit." }, { status: 403 });
      }
      if (error.message === "CANCELLED_VISIT") {
        return NextResponse.json({ error: "Cannot start a cancelled visit." }, { status: 400 });
      }
      if (error.message === "ALREADY_STARTED") {
        return NextResponse.json({ error: "Visit has already been started." }, { status: 400 });
      }
    }
    return jsonError(error);
  }
}
