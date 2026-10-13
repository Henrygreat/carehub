import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission, canAccessShift } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { shiftSchema } from "@/lib/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "shifts:read");

    const { id } = await params;

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

    const shift = await db.shift.findUnique({
      where: {
        id,
        organisationId: context.organisation.id,
      },
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
        cancellationNote: true,
        createdAt: true,
        updatedAt: true,
        assignments: {
          select: {
            id: true,
            staffProfileId: true,
            actualStart: true,
            actualEnd: true,
            status: true,
            notes: true,
            staffProfile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        careNotes: {
          select: {
            id: true,
            content: true,
            isIncident: true,
            isPrivate: true,
            createdAt: true,
            authorMembership: {
              select: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    // For care workers, verify they are assigned to this shift
    const isAssigned = shift.assignments.some((a) => a.staffProfileId === staffProfileId);
    const accessContext = { membership: context.membership, staffProfileId };
    if (!canAccessShift(accessContext, isAssigned)) {
      return NextResponse.json({ error: "You are not assigned to this shift." }, { status: 403 });
    }

    return privateJson({ data: shift });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
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
    const body = await request.json();

    // Allow partial updates
    const updateSchema = shiftSchema.partial();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    const updatedShift = await db.$transaction(async (transaction) => {
      const existing = await transaction.shift.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      if (existing.status === "CANCELLED") {
        throw new Error("CANCELLED_SHIFT");
      }

      // Prepare update data
      const updateData: Record<string, unknown> = {};

      if (input.locationName !== undefined) {
        updateData.locationName = input.locationName;
      }
      if (input.locationAddress !== undefined) {
        updateData.locationAddress = input.locationAddress;
      }
      if (input.scheduledDate !== undefined) {
        updateData.scheduledDate = input.scheduledDate;
      }
      if (input.scheduledStart !== undefined) {
        updateData.scheduledStart = new Date(input.scheduledStart);
      }
      if (input.scheduledEnd !== undefined) {
        updateData.scheduledEnd = new Date(input.scheduledEnd);
      }
      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }
      if (input.isOvernight !== undefined) {
        updateData.isOvernight = input.isOvernight;
      }

      const updated = await transaction.shift.update({
        where: { id },
        data: updateData,
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "shift.updated",
          entityType: "Shift",
          entityId: id,
          metadata: { fields: Object.keys(updateData) },
        },
      });

      return updated;
    });

    return privateJson({ data: updatedShift });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Shift not found." }, { status: 404 });
      }
      if (error.message === "CANCELLED_SHIFT") {
        return NextResponse.json({ error: "Cannot update a cancelled shift." }, { status: 400 });
      }
    }
    return jsonError(error);
  }
}
