import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { carePlanTaskSchema } from "@/lib/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "carePlans:read");

    const { id: carePlanId } = await params;
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    // Verify care plan exists and belongs to org
    const carePlan = await db.carePlan.findUnique({
      where: {
        id: carePlanId,
        organisationId: context.organisation.id,
      },
      select: { id: true, isConfidential: true, clientId: true },
    });

    if (!carePlan) {
      return NextResponse.json({ error: "Care plan not found." }, { status: 404 });
    }

    // Care workers cannot access confidential plans
    if (context.membership.role === "CARE_WORKER" && carePlan.isConfidential) {
      return NextResponse.json({ error: "This care plan is confidential." }, { status: 403 });
    }

    const tasks = await db.carePlanTask.findMany({
      where: {
        carePlanId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: {
        id: true,
        title: true,
        description: true,
        frequency: true,
        isRequired: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    return privateJson({ data: tasks });
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
    assertPermission(context.membership, "carePlans:update");

    const { id: carePlanId } = await params;
    const body = await request.json();

    // Override carePlanId from URL
    const parsed = carePlanTaskSchema.omit({ carePlanId: true }).safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    // Verify care plan exists and belongs to org
    const carePlan = await db.carePlan.findUnique({
      where: {
        id: carePlanId,
        organisationId: context.organisation.id,
      },
      select: { id: true, status: true },
    });

    if (!carePlan) {
      return NextResponse.json({ error: "Care plan not found." }, { status: 404 });
    }

    if (carePlan.status === "ARCHIVED") {
      return NextResponse.json({ error: "Cannot add tasks to archived care plan." }, { status: 400 });
    }

    const task = await db.$transaction(async (transaction) => {
      // Get current max sort order
      const maxSort = await transaction.carePlanTask.aggregate({
        where: { carePlanId },
        _max: { sortOrder: true },
      });
      const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

      const created = await transaction.carePlanTask.create({
        data: {
          carePlanId,
          title: input.title,
          description: input.description ?? null,
          frequency: input.frequency,
          isRequired: input.isRequired,
          sortOrder: input.sortOrder ?? nextSortOrder,
          isActive: input.isActive,
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "carePlanTask.created",
          entityType: "CarePlanTask",
          entityId: created.id,
          metadata: { carePlanId },
        },
      });

      return created;
    });

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
