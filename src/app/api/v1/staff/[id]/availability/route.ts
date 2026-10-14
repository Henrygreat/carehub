import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission, hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { staffAvailabilityBatchSchema } from "@/lib/validation";
import { parseTimeString } from "@/lib/scheduling";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "availability:read");

    const { id: staffProfileId } = await params;

    // Verify staff profile belongs to org
    const staffProfile = await db.staffProfile.findUnique({
      where: {
        id: staffProfileId,
        organisationId: context.organisation.id,
      },
      select: { id: true, membershipUserId: true },
    });

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
    }

    // Care workers can only view their own availability
    if (
      context.membership.role === "CARE_WORKER" &&
      staffProfile.membershipUserId !== context.userId
    ) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const availability = await db.staffAvailability.findMany({
      where: {
        staffProfileId,
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: today } },
        ],
      },
      orderBy: [{ dayOfWeek: "asc" }, { effectiveFrom: "desc" }],
    });

    // Group by day of week, taking most recent effective
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const grouped = availability.reduce((acc, a) => {
      if (!acc[a.dayOfWeek]) {
        acc[a.dayOfWeek] = {
          ...a,
          dayName: dayNames[a.dayOfWeek],
          startTimeStr: a.startTime.toTimeString().slice(0, 5),
          endTimeStr: a.endTime.toTimeString().slice(0, 5),
        };
      }
      return acc;
    }, {} as Record<number, typeof availability[0] & { dayName: string; startTimeStr: string; endTimeStr: string }>);

    return privateJson({
      data: {
        all: availability,
        current: Object.values(grouped),
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
    const { id: staffProfileId } = await params;

    // Verify staff profile belongs to org
    const staffProfile = await db.staffProfile.findUnique({
      where: {
        id: staffProfileId,
        organisationId: context.organisation.id,
      },
      select: { id: true, membershipUserId: true },
    });

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
    }

    // Check permissions: care workers can update their own, managers can manage all
    const isOwnProfile = staffProfile.membershipUserId === context.userId;
    if (isOwnProfile) {
      assertPermission(context.membership, "availability:update");
    } else {
      assertPermission(context.membership, "availability:manage");
    }

    const parsed = staffAvailabilityBatchSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const { availability } = parsed.data;

    // Use transaction to update availability
    const result = await db.$transaction(async (transaction) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // End existing availability for days being updated
      const daysToUpdate = [...new Set(availability.map((a) => a.dayOfWeek))];

      await transaction.staffAvailability.updateMany({
        where: {
          staffProfileId,
          dayOfWeek: { in: daysToUpdate },
          effectiveTo: null,
        },
        data: {
          effectiveTo: today,
        },
      });

      // Create new availability records
      const created = [];
      for (const a of availability) {
        const record = await transaction.staffAvailability.create({
          data: {
            organisationId: context.organisation.id,
            staffProfileId,
            dayOfWeek: a.dayOfWeek,
            startTime: parseTimeString(a.startTime),
            endTime: parseTimeString(a.endTime),
            isPreferred: a.isPreferred,
            effectiveFrom: a.effectiveFrom,
            effectiveTo: a.effectiveTo ?? null,
          },
        });
        created.push(record);
      }

      // Audit log
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "staffAvailability.updated",
          entityType: "StaffProfile",
          entityId: staffProfileId,
          metadata: {
            daysUpdated: daysToUpdate,
            recordCount: created.length,
          },
        },
      });

      return created;
    });

    return privateJson({ data: result });
  } catch (error) {
    return jsonError(error);
  }
}
