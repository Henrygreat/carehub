import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "clients:update");

    const { id, contactId } = await params;

    await db.$transaction(async (transaction) => {
      // Verify client belongs to org
      const client = await transaction.client.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });

      if (!client) {
        throw new Error("NOT_FOUND");
      }

      // Verify contact belongs to this client
      const contact = await transaction.emergencyContact.findUnique({
        where: {
          id: contactId,
          clientId: id,
        },
        select: { id: true },
      });

      if (!contact) {
        throw new Error("CONTACT_NOT_FOUND");
      }

      await transaction.emergencyContact.delete({
        where: { id: contactId },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "client.emergency_contact.deleted",
          entityType: "EmergencyContact",
          entityId: contactId,
          metadata: { clientId: id },
        },
      });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "CONTACT_NOT_FOUND") {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }
    return jsonError(error);
  }
}
