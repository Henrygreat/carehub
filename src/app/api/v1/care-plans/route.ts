import { CarePlanStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { carePlanWithTasksSchema } from "@/lib/validation";

const CARE_PLANS_PAGE_SIZE = 50;

export async function GET(request: Request) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "carePlans:read");

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const statusParam = searchParams.get("status");
    const reviewDueBefore = searchParams.get("reviewDueBefore");

    // Parse status filter
    let status: CarePlanStatus | undefined;
    if (statusParam && Object.values(CarePlanStatus).includes(statusParam as CarePlanStatus)) {
      status = statusParam as CarePlanStatus;
    }

    // Build where clause
    const where: Prisma.CarePlanWhereInput = {
      organisationId: context.organisation.id,
      ...(clientId && { clientId }),
      ...(status && { status }),
    };

    // Filter for care plans due for review
    if (reviewDueBefore) {
      where.reviewDate = { lte: new Date(reviewDueBefore) };
      where.status = { in: ["ACTIVE", "UNDER_REVIEW"] };
    }

    // Care workers can only see care plans for clients they have visits assigned to
    if (context.membership.role === "CARE_WORKER") {
      const staffProfile = await db.staffProfile.findFirst({
        where: {
          membershipUserId: context.userId,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });

      if (staffProfile) {
        // Get client IDs this care worker has visits assigned to
        const assignedVisits = await db.careVisit.findMany({
          where: {
            staffProfileId: staffProfile.id,
            organisationId: context.organisation.id,
          },
          select: { clientId: true },
          distinct: ["clientId"],
        });
        const assignedClientIds = assignedVisits.map((v) => v.clientId);

        if (assignedClientIds.length === 0) {
          return privateJson({ data: [], pagination: { total: 0 } });
        }
        where.clientId = { in: assignedClientIds };
        // Care workers can only see non-confidential, active care plans
        where.isConfidential = false;
        where.status = "ACTIVE";
      } else {
        return privateJson({ data: [], pagination: { total: 0 } });
      }
    }

    const [total, data] = await db.$transaction([
      db.carePlan.count({ where }),
      db.carePlan.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          startDate: true,
          reviewDate: true,
          endDate: true,
          isConfidential: true,
          createdAt: true,
          updatedAt: true,
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              clientReference: true,
            },
          },
          _count: {
            select: { tasks: { where: { isActive: true } } },
          },
        },
        orderBy: [{ reviewDate: "asc" }, { createdAt: "desc" }],
        take: CARE_PLANS_PAGE_SIZE,
      }),
    ]);

    return privateJson({
      data,
      pagination: { total },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "carePlans:create");

    const parsed = carePlanWithTasksSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const { tasks, ...input } = parsed.data;

    // Validate client belongs to org
    const client = await db.client.findUnique({
      where: {
        id: input.clientId,
        organisationId: context.organisation.id,
      },
      select: { id: true, status: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    if (client.status === "ARCHIVED") {
      return NextResponse.json({ error: "Cannot create care plans for archived clients." }, { status: 400 });
    }

    const carePlan = await db.$transaction(async (transaction) => {
      const created = await transaction.carePlan.create({
        data: {
          organisationId: context.organisation.id,
          clientId: input.clientId,
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          startDate: input.startDate,
          reviewDate: input.reviewDate ?? null,
          endDate: input.endDate ?? null,
          specialInstructions: input.specialInstructions ?? null,
          isConfidential: input.isConfidential,
        },
      });

      // Create tasks if provided
      if (tasks && tasks.length > 0) {
        await transaction.carePlanTask.createMany({
          data: tasks.map((task, index) => ({
            carePlanId: created.id,
            title: task.title,
            description: task.description ?? null,
            frequency: task.frequency,
            isRequired: task.isRequired,
            sortOrder: task.sortOrder ?? index,
          })),
        });
      }

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "carePlan.created",
          entityType: "CarePlan",
          entityId: created.id,
          metadata: { clientId: input.clientId, taskCount: tasks?.length ?? 0 },
        },
      });

      return created;
    });

    return NextResponse.json({ data: carePlan }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
