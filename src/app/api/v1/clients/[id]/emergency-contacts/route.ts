import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { emergencyContactSchema } from "@/lib/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "clients:read");

    const { id } = await params;

    // Verify client belongs to org
    const client = await db.client.findUnique({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const contacts = await db.emergencyContact.findMany({
      where: { clientId: id },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });

    return privateJson({ data: contacts });
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
    assertPermission(context.membership, "clients:update");

    const { id } = await params;
    const parsed = emergencyContactSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    const contact = await db.$transaction(async (transaction) => {
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

      // If this is marked as primary, unset other primary contacts
      if (input.isPrimary) {
        await transaction.emergencyContact.updateMany({
          where: { clientId: id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const created = await transaction.emergencyContact.create({
        data: {
          ...input,
          clientId: id,
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "client.emergency_contact.created",
          entityType: "EmergencyContact",
          entityId: created.id,
          metadata: { clientId: id },
        },
      });

      return created;
    });

    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    return jsonError(error);
  }
}
