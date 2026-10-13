import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission, canAccessCarePlan } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { carePlanSchema } from "@/lib/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "carePlans:read");

    const { id } = await params;

    // For care workers, get their assigned client IDs
    let assignedClientIds: string[] | undefined;
    if (context.membership.role === "CARE_WORKER") {
      const staffProfile = await db.staffProfile.findFirst({
        where: {
          membershipUserId: context.userId,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });

      if (staffProfile) {
        const assignedVisits = await db.careVisit.findMany({
          where: {
            staffProfileId: staffProfile.id,
            organisationId: context.organisation.id,
          },
          select: { clientId: true },
          distinct: ["clientId"],
        });
        assignedClientIds = assignedVisits.map((v) => v.clientId);
      }
    }

    const carePlan = await db.carePlan.findUnique({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        startDate: true,
        reviewDate: true,
        endDate: true,
        specialInstructions: true,
        isConfidential: true,
        createdAt: true,
        updatedAt: true,
        clientId: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            clientReference: true,
          },
        },
        tasks: {
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            description: true,
            frequency: true,
            isRequired: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!carePlan) {
      return NextResponse.json({ error: "Care plan not found." }, { status: 404 });
    }

    // Check access for care workers
    const accessContext = { membership: context.membership, assignedClientIds };
    if (!canAccessCarePlan(accessContext, carePlan)) {
      return NextResponse.json({ error: "You do not have access to this care plan." }, { status: 403 });
    }

    // Care workers cannot see confidential care plans
    if (context.membership.role === "CARE_WORKER" && carePlan.isConfidential) {
      return NextResponse.json({ error: "This care plan is confidential." }, { status: 403 });
    }

    return privateJson({ data: carePlan });
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
    assertPermission(context.membership, "carePlans:update");

    const { id } = await params;
    const body = await request.json();

    // Allow partial updates
    const updateSchema = carePlanSchema.partial();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    // Check if archiving - requires special permission
    if (input.status === "ARCHIVED") {
      assertPermission(context.membership, "carePlans:archive");
    }

    const updatedCarePlan = await db.$transaction(async (transaction) => {
      const existing = await transaction.carePlan.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      // If client is changing, validate new client
      if (input.clientId) {
        const client = await transaction.client.findUnique({
          where: {
            id: input.clientId,
            organisationId: context.organisation.id,
          },
          select: { id: true, status: true },
        });
        if (!client) throw new Error("CLIENT_NOT_FOUND");
        if (client.status === "ARCHIVED") throw new Error("CLIENT_ARCHIVED");
      }

      const updated = await transaction.carePlan.update({
        where: { id },
        data: {
          ...(input.clientId && { clientId: input.clientId }),
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.startDate !== undefined && { startDate: input.startDate }),
          ...(input.reviewDate !== undefined && { reviewDate: input.reviewDate }),
          ...(input.endDate !== undefined && { endDate: input.endDate }),
          ...(input.specialInstructions !== undefined && { specialInstructions: input.specialInstructions }),
          ...(input.isConfidential !== undefined && { isConfidential: input.isConfidential }),
        },
      });

      const changedFields = Object.keys(input);
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: input.status === "ARCHIVED" ? "carePlan.archived" : "carePlan.updated",
          entityType: "CarePlan",
          entityId: id,
          metadata: { fields: changedFields },
        },
      });

      return updated;
    });

    return privateJson({ data: updatedCarePlan });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Care plan not found." }, { status: 404 });
      }
      if (error.message === "CLIENT_NOT_FOUND") {
        return NextResponse.json({ error: "Client not found." }, { status: 404 });
      }
      if (error.message === "CLIENT_ARCHIVED") {
        return NextResponse.json({ error: "Cannot assign care plan to archived client." }, { status: 400 });
      }
    }
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
    assertPermission(context.membership, "carePlans:archive");

    const { id } = await params;

    await db.$transaction(async (transaction) => {
      const existing = await transaction.carePlan.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      // Soft delete by setting status to ARCHIVED
      await transaction.carePlan.update({
        where: { id },
        data: { status: "ARCHIVED" },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "carePlan.archived",
          entityType: "CarePlan",
          entityId: id,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Care plan not found." }, { status: 404 });
    }
    return jsonError(error);
  }
}
