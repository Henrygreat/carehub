import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission, canAccessIncident } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { incidentUpdateSchema, incidentReviewSchema } from "@/lib/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "incidents:read");

    const { id } = await params;

    // Get staff profile for care workers
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

    const incident = await db.incident.findUnique({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      select: {
        id: true,
        incidentReference: true,
        category: true,
        severity: true,
        status: true,
        occurredAt: true,
        location: true,
        description: true,
        immediateAction: true,
        followUpRequired: true,
        followUpNotes: true,
        resolutionNotes: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        reportedById: true,
        visitId: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            clientReference: true,
          },
        },
        visit: {
          select: {
            id: true,
            scheduledDate: true,
            staffProfileId: true,
          },
        },
        reportedBy: {
          select: {
            user: {
              select: { name: true },
            },
          },
        },
        reviewer: {
          select: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!incident) {
      return NextResponse.json({ error: "Incident not found." }, { status: 404 });
    }

    // Check access for care workers
    const accessContext = {
      membership: { ...context.membership, id: context.membership.id },
      staffProfileId,
    };
    if (!canAccessIncident(accessContext, incident, incident.visit?.staffProfileId)) {
      return NextResponse.json({ error: "You do not have access to this incident." }, { status: 403 });
    }

    return privateJson({ data: incident });
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
    const { id } = await params;
    const body = await request.json();

    // Determine if this is a review action or a regular update
    const isReview = body.status !== undefined;

    if (isReview) {
      // Review requires special permission
      assertPermission(context.membership, "incidents:review");

      const parsed = incidentReviewSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error.flatten());

      const input = parsed.data;

      const updatedIncident = await db.$transaction(async (transaction) => {
        const existing = await transaction.incident.findUnique({
          where: {
            id,
            organisationId: context.organisation.id,
          },
          select: { id: true, status: true },
        });

        if (!existing) {
          throw new Error("NOT_FOUND");
        }

        const updateData: Record<string, unknown> = {
          status: input.status,
        };

        // Set reviewer when status changes
        if (input.status !== existing.status) {
          updateData.reviewerId = context.membership.id;
        }

        if (input.followUpNotes !== undefined) {
          updateData.followUpNotes = input.followUpNotes;
        }

        if (input.resolutionNotes !== undefined) {
          updateData.resolutionNotes = input.resolutionNotes;
        }

        // Set resolvedAt when status changes to RESOLVED or CLOSED
        if (input.status === "RESOLVED" || input.status === "CLOSED") {
          if (existing.status !== "RESOLVED" && existing.status !== "CLOSED") {
            updateData.resolvedAt = new Date();
          }
        }

        const updated = await transaction.incident.update({
          where: { id },
          data: updateData,
        });

        await transaction.auditLog.create({
          data: {
            organisationId: context.organisation.id,
            actorUserId: context.userId,
            actorMembershipId: context.membership.id,
            action: "incident.reviewed",
            entityType: "Incident",
            entityId: id,
            metadata: {
              previousStatus: existing.status,
              newStatus: input.status,
            },
          },
        });

        return updated;
      });

      return privateJson({ data: updatedIncident });
    } else {
      // Regular update - reporter can update their own incident, or those with update permission
      assertPermission(context.membership, "incidents:update");

      const parsed = incidentUpdateSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error.flatten());

      const input = parsed.data;

      const updatedIncident = await db.$transaction(async (transaction) => {
        const existing = await transaction.incident.findUnique({
          where: {
            id,
            organisationId: context.organisation.id,
          },
          select: {
            id: true,
            reportedById: true,
            status: true,
          },
        });

        if (!existing) {
          throw new Error("NOT_FOUND");
        }

        // Care workers can only update incidents they reported
        if (context.membership.role === "CARE_WORKER") {
          if (existing.reportedById !== context.membership.id) {
            throw new Error("ACCESS_DENIED");
          }
          // Can't update closed/resolved incidents
          if (existing.status === "CLOSED" || existing.status === "RESOLVED") {
            throw new Error("INCIDENT_CLOSED");
          }
        }

        const updateData: Record<string, unknown> = {};

        if (input.severity !== undefined) updateData.severity = input.severity;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.immediateAction !== undefined) updateData.immediateAction = input.immediateAction;
        if (input.followUpRequired !== undefined) updateData.followUpRequired = input.followUpRequired;
        if (input.followUpNotes !== undefined) updateData.followUpNotes = input.followUpNotes;

        const updated = await transaction.incident.update({
          where: { id },
          data: updateData,
        });

        await transaction.auditLog.create({
          data: {
            organisationId: context.organisation.id,
            actorUserId: context.userId,
            actorMembershipId: context.membership.id,
            action: "incident.updated",
            entityType: "Incident",
            entityId: id,
            metadata: { fields: Object.keys(updateData) },
          },
        });

        return updated;
      });

      return privateJson({ data: updatedIncident });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Incident not found." }, { status: 404 });
      }
      if (error.message === "ACCESS_DENIED") {
        return NextResponse.json({ error: "You can only update incidents you reported." }, { status: 403 });
      }
      if (error.message === "INCIDENT_CLOSED") {
        return NextResponse.json({ error: "Cannot update closed or resolved incidents." }, { status: 400 });
      }
    }
    return jsonError(error);
  }
}
