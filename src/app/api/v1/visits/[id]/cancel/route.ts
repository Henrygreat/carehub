import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { visitCancellationSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "visits:cancel");

    const { id } = await params;
    const parsed = visitCancellationSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const { cancellationNote } = parsed.data;

    const updatedVisit = await db.$transaction(async (transaction) => {
      const existing = await transaction.careVisit.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: { id: true, status: true, clientId: true },
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

      const updated = await transaction.careVisit.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancellationNote,
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "visit.cancelled",
          entityType: "CareVisit",
          entityId: id,
          metadata: { clientId: existing.clientId },
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
      if (error.message === "ALREADY_CANCELLED") {
        return NextResponse.json({ error: "Visit is already cancelled." }, { status: 400 });
      }
      if (error.message === "ALREADY_COMPLETED") {
        return NextResponse.json({ error: "Cannot cancel a completed visit." }, { status: 400 });
      }
    }
    return jsonError(error);
  }
}
