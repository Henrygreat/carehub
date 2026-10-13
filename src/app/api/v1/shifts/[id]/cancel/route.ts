import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { shiftCancellationSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "shifts:cancel");

    const { id } = await params;
    const parsed = shiftCancellationSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const { cancellationNote } = parsed.data;

    const updatedShift = await db.$transaction(async (transaction) => {
      const existing = await transaction.shift.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: { id: true, status: true, locationName: true },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      if (existing.status === "CANCELLED") {
        throw new Error("ALREADY_CANCELLED");
      }

      if (existing.status === "COMPLETED") {
        throw new Error("ALREADY_COMPLETED");
      }

      // Cancel the shift and all assignments
      const updated = await transaction.shift.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancellationNote,
        },
      });

      // Cancel all assignments
      await transaction.shiftAssignment.updateMany({
        where: { shiftId: id },
        data: { status: "CANCELLED" },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "shift.cancelled",
          entityType: "Shift",
          entityId: id,
          metadata: { locationName: existing.locationName },
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
      if (error.message === "ALREADY_CANCELLED") {
        return NextResponse.json({ error: "Shift is already cancelled." }, { status: 400 });
      }
      if (error.message === "ALREADY_COMPLETED") {
        return NextResponse.json({ error: "Cannot cancel a completed shift." }, { status: 400 });
      }
    }
    return jsonError(error);
  }
}
