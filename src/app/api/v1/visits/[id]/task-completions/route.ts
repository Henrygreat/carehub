import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission, canAccessVisit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { batchTaskCompletionSchema } from "@/lib/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "tasks:complete");

    const { id: visitId } = await params;

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

    // Get the visit
    const visit = await db.careVisit.findUnique({
      where: {
        id: visitId,
        organisationId: context.organisation.id,
      },
      select: {
        id: true,
        staffProfileId: true,
        clientId: true,
        status: true,
      },
    });

    if (!visit) {
      return NextResponse.json({ error: "Visit not found." }, { status: 404 });
    }

    // Check access for care workers
    const accessContext = { membership: context.membership, staffProfileId };
    if (!canAccessVisit(accessContext, visit)) {
      return NextResponse.json({ error: "You are not assigned to this visit." }, { status: 403 });
    }

    // Get task completions for this visit
    const completions = await db.visitTaskCompletion.findMany({
      where: { visitId },
      select: {
        id: true,
        taskId: true,
        completed: true,
        unableToComplete: true,
        notes: true,
        reason: true,
        completedAt: true,
        createdAt: true,
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            frequency: true,
            isRequired: true,
            carePlan: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        completedBy: {
          select: {
            user: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Also get active care plan tasks for this client that haven't been completed
    const activeTasks = await db.carePlanTask.findMany({
      where: {
        carePlan: {
          clientId: visit.clientId,
          status: "ACTIVE",
          isConfidential: false,
        },
        isActive: true,
        id: {
          notIn: completions.map((c) => c.taskId),
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        frequency: true,
        isRequired: true,
        carePlan: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [{ carePlan: { title: "asc" } }, { sortOrder: "asc" }],
    });

    return privateJson({
      data: {
        completions,
        pendingTasks: activeTasks,
      },
    });
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
    assertPermission(context.membership, "tasks:complete");

    const { id: visitId } = await params;
    const body = await request.json();

    const parsed = batchTaskCompletionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten());

    const { completions } = parsed.data;

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

    const result = await db.$transaction(async (transaction) => {
      // Verify visit exists, belongs to org, and is accessible
      const visit = await transaction.careVisit.findUnique({
        where: {
          id: visitId,
          organisationId: context.organisation.id,
        },
        select: {
          id: true,
          staffProfileId: true,
          clientId: true,
          status: true,
        },
      });

      if (!visit) {
        throw new Error("VISIT_NOT_FOUND");
      }

      // Check access for care workers
      const accessContext = { membership: context.membership, staffProfileId };
      if (!canAccessVisit(accessContext, visit)) {
        throw new Error("ACCESS_DENIED");
      }

      // Visit must be in progress or completed to record task completions
      if (visit.status !== "IN_PROGRESS" && visit.status !== "COMPLETED") {
        throw new Error("VISIT_NOT_ACTIVE");
      }

      // Validate all tasks exist and belong to active care plans for this client
      const taskIds = completions.map((c) => c.taskId);
      const validTasks = await transaction.carePlanTask.findMany({
        where: {
          id: { in: taskIds },
          isActive: true,
          carePlan: {
            clientId: visit.clientId,
            status: "ACTIVE",
          },
        },
        select: { id: true },
      });

      const validTaskIds = new Set(validTasks.map((t) => t.id));
      const invalidTaskIds = taskIds.filter((id) => !validTaskIds.has(id));

      if (invalidTaskIds.length > 0) {
        throw new Error(`INVALID_TASKS:${invalidTaskIds.join(",")}`);
      }

      // Upsert completions
      const results = [];
      for (const completion of completions) {
        const now = new Date();
        const result = await transaction.visitTaskCompletion.upsert({
          where: {
            visitId_taskId: {
              visitId,
              taskId: completion.taskId,
            },
          },
          create: {
            visitId,
            taskId: completion.taskId,
            completedById: context.membership.id,
            completed: completion.completed,
            unableToComplete: completion.unableToComplete,
            notes: completion.notes ?? null,
            reason: completion.reason ?? null,
            completedAt: completion.completed ? now : null,
          },
          update: {
            completed: completion.completed,
            unableToComplete: completion.unableToComplete,
            notes: completion.notes ?? null,
            reason: completion.reason ?? null,
            completedAt: completion.completed ? now : null,
          },
        });
        results.push(result);
      }

      // Create audit log
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "visitTasks.recorded",
          entityType: "CareVisit",
          entityId: visitId,
          metadata: {
            taskCount: completions.length,
            completedCount: completions.filter((c) => c.completed).length,
            unableCount: completions.filter((c) => c.unableToComplete).length,
          },
        },
      });

      return results;
    });

    return privateJson({ data: result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "VISIT_NOT_FOUND") {
        return NextResponse.json({ error: "Visit not found." }, { status: 404 });
      }
      if (error.message === "ACCESS_DENIED") {
        return NextResponse.json({ error: "You are not assigned to this visit." }, { status: 403 });
      }
      if (error.message === "VISIT_NOT_ACTIVE") {
        return NextResponse.json(
          { error: "Can only record task completions for in-progress or completed visits." },
          { status: 400 },
        );
      }
      if (error.message.startsWith("INVALID_TASKS:")) {
        const invalidIds = error.message.replace("INVALID_TASKS:", "");
        return NextResponse.json(
          { error: `Invalid or inactive tasks: ${invalidIds}` },
          { status: 400 },
        );
      }
    }
    return jsonError(error);
  }
}
