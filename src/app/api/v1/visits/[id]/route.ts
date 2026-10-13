import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission, canAccessVisit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { careVisitSchema } from "@/lib/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "visits:read");

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

    const visit = await db.careVisit.findUnique({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      select: {
        id: true,
        staffProfileId: true,
        scheduledDate: true,
        scheduledStart: true,
        scheduledEnd: true,
        actualStart: true,
        actualEnd: true,
        status: true,
        visitType: true,
        notes: true,
        cancellationNote: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            clientReference: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            phone: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            postcode: true,
            careNotes: true,
            emergencyContacts: {
              select: {
                id: true,
                name: true,
                relationship: true,
                phone: true,
                isPrimary: true,
              },
              orderBy: { isPrimary: "desc" },
            },
          },
        },
        staffProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
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

    if (!visit) {
      return NextResponse.json({ error: "Visit not found." }, { status: 404 });
    }

    // For care workers, verify they have access to this visit
    const accessContext = { membership: context.membership, staffProfileId };
    if (!canAccessVisit(accessContext, visit)) {
      return NextResponse.json({ error: "You are not assigned to this visit." }, { status: 403 });
    }

    return privateJson({ data: visit });
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
    assertPermission(context.membership, "visits:update");

    const { id } = await params;
    const body = await request.json();

    // Allow partial updates
    const updateSchema = careVisitSchema.partial();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    const updatedVisit = await db.$transaction(async (transaction) => {
      const existing = await transaction.careVisit.findUnique({
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
        throw new Error("CANCELLED_VISIT");
      }

      // Prepare update data
      const updateData: Record<string, unknown> = {};

      if (input.clientId !== undefined) {
        const client = await transaction.client.findUnique({
          where: {
            id: input.clientId,
            organisationId: context.organisation.id,
          },
          select: { id: true },
        });
        if (!client) throw new Error("CLIENT_NOT_FOUND");
        updateData.clientId = input.clientId;
      }

      if (input.staffProfileId !== undefined) {
        if (input.staffProfileId === null) {
          updateData.staffProfileId = null;
        } else {
          const staffProfile = await transaction.staffProfile.findUnique({
            where: {
              id: input.staffProfileId,
              organisationId: context.organisation.id,
            },
            select: { id: true },
          });
          if (!staffProfile) throw new Error("STAFF_NOT_FOUND");
          updateData.staffProfileId = input.staffProfileId;
        }
      }

      if (input.scheduledDate !== undefined) {
        updateData.scheduledDate = input.scheduledDate;
      }

      if (input.scheduledStart !== undefined) {
        const referenceDate = new Date("1970-01-01");
        const [hour, min] = input.scheduledStart.split(":").map(Number);
        const time = new Date(referenceDate);
        time.setUTCHours(hour, min, 0, 0);
        updateData.scheduledStart = time;
      }

      if (input.scheduledEnd !== undefined) {
        const referenceDate = new Date("1970-01-01");
        const [hour, min] = input.scheduledEnd.split(":").map(Number);
        const time = new Date(referenceDate);
        time.setUTCHours(hour, min, 0, 0);
        updateData.scheduledEnd = time;
      }

      if (input.visitType !== undefined) {
        updateData.visitType = input.visitType;
      }

      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      const updated = await transaction.careVisit.update({
        where: { id },
        data: updateData,
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "visit.updated",
          entityType: "CareVisit",
          entityId: id,
          metadata: { fields: Object.keys(updateData) },
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
      if (error.message === "CANCELLED_VISIT") {
        return NextResponse.json({ error: "Cannot update a cancelled visit." }, { status: 400 });
      }
      if (error.message === "CLIENT_NOT_FOUND") {
        return NextResponse.json({ error: "Client not found." }, { status: 404 });
      }
      if (error.message === "STAFF_NOT_FOUND") {
        return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
      }
    }
    return jsonError(error);
  }
}
