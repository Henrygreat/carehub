import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { carePlanTaskSchema } from "@/lib/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "carePlans:read");

    const { id: carePlanId, taskId } = await params;

    // Verify care plan exists and belongs to org
    const carePlan = await db.carePlan.findUnique({
      where: {
        id: carePlanId,
        organisationId: context.organisation.id,
      },
      select: { id: true, isConfidential: true },
    });

    if (!carePlan) {
      return NextResponse.json({ error: "Care plan not found." }, { status: 404 });
    }

    if (context.membership.role === "CARE_WORKER" && carePlan.isConfidential) {
      return NextResponse.json({ error: "This care plan is confidential." }, { status: 403 });
    }

    const task = await db.carePlanTask.findUnique({
      where: {
        id: taskId,
        carePlanId,
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
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    return privateJson({ data: task });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "carePlans:update");

    const { id: carePlanId, taskId } = await params;
    const body = await request.json();

    // Allow partial updates (exclude carePlanId - can't change parent)
    const updateSchema = carePlanTaskSchema.omit({ carePlanId: true }).partial();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    const updatedTask = await db.$transaction(async (transaction) => {
      // Verify care plan exists and belongs to org
      const carePlan = await transaction.carePlan.findUnique({
        where: {
          id: carePlanId,
          organisationId: context.organisation.id,
        },
        select: { id: true, status: true },
      });

      if (!carePlan) {
        throw new Error("CARE_PLAN_NOT_FOUND");
      }

      if (carePlan.status === "ARCHIVED") {
        throw new Error("CARE_PLAN_ARCHIVED");
      }

      const existing = await transaction.carePlanTask.findUnique({
        where: {
          id: taskId,
          carePlanId,
        },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("TASK_NOT_FOUND");
      }

      const updated = await transaction.carePlanTask.update({
        where: { id: taskId },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.frequency !== undefined && { frequency: input.frequency }),
          ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "carePlanTask.updated",
          entityType: "CarePlanTask",
          entityId: taskId,
          metadata: { carePlanId, fields: Object.keys(input) },
        },
      });

      return updated;
    });

    return privateJson({ data: updatedTask });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CARE_PLAN_NOT_FOUND") {
        return NextResponse.json({ error: "Care plan not found." }, { status: 404 });
      }
      if (error.message === "CARE_PLAN_ARCHIVED") {
        return NextResponse.json({ error: "Cannot update tasks in archived care plan." }, { status: 400 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
    }
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "carePlans:update");

    const { id: carePlanId, taskId } = await params;

    await db.$transaction(async (transaction) => {
      // Verify care plan exists and belongs to org
      const carePlan = await transaction.carePlan.findUnique({
        where: {
          id: carePlanId,
          organisationId: context.organisation.id,
        },
        select: { id: true, status: true },
      });

      if (!carePlan) {
        throw new Error("CARE_PLAN_NOT_FOUND");
      }

      if (carePlan.status === "ARCHIVED") {
        throw new Error("CARE_PLAN_ARCHIVED");
      }

      const existing = await transaction.carePlanTask.findUnique({
        where: {
          id: taskId,
          carePlanId,
        },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("TASK_NOT_FOUND");
      }

      // Soft delete - set isActive to false
      await transaction.carePlanTask.update({
        where: { id: taskId },
        data: { isActive: false },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "carePlanTask.deactivated",
          entityType: "CarePlanTask",
          entityId: taskId,
          metadata: { carePlanId },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CARE_PLAN_NOT_FOUND") {
        return NextResponse.json({ error: "Care plan not found." }, { status: 404 });
      }
      if (error.message === "CARE_PLAN_ARCHIVED") {
        return NextResponse.json({ error: "Cannot delete tasks in archived care plan." }, { status: 400 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
    }
    return jsonError(error);
  }
}
