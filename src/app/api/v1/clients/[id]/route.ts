import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { clientSchema } from "@/lib/validation";

function clientDetailFields(role: Role) {
  if (role === "CARE_WORKER") {
    return {
      id: true,
      clientReference: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      postcode: true,
      status: true,
      createdAt: true,
      emergencyContacts: {
        select: {
          id: true,
          name: true,
          relationship: true,
          phone: true,
          isPrimary: true,
        },
        orderBy: { isPrimary: "desc" as const },
      },
    } as const;
  }
  return {
    id: true,
    clientReference: true,
    firstName: true,
    lastName: true,
    preferredName: true,
    dateOfBirth: true,
    email: true,
    phone: true,
    addressLine1: true,
    addressLine2: true,
    city: true,
    postcode: true,
    careNotes: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    emergencyContacts: {
      select: {
        id: true,
        name: true,
        relationship: true,
        phone: true,
        email: true,
        isPrimary: true,
      },
      orderBy: { isPrimary: "desc" as const },
    },
  } as const;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "clients:read");

    const { id } = await params;
    const client = await db.client.findUnique({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      select: clientDetailFields(context.membership.role),
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    // For care workers, check if they have any assigned visits to this client
    if (context.membership.role === "CARE_WORKER") {
      const staffProfile = await db.staffProfile.findFirst({
        where: {
          membershipUserId: context.userId,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });

      if (staffProfile) {
        const hasAccess = await db.careVisit.findFirst({
          where: {
            clientId: id,
            staffProfileId: staffProfile.id,
            organisationId: context.organisation.id,
          },
          select: { id: true },
        });

        if (!hasAccess) {
          return NextResponse.json(
            { error: "You are not assigned to this client." },
            { status: 403 },
          );
        }
      }
    }

    return privateJson({ data: client });
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
    assertPermission(context.membership, "clients:update");

    const { id } = await params;
    const body = await request.json();

    // Validate the update data - allow partial updates
    const updateSchema = clientSchema.partial();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    // Check if status is being changed to ARCHIVED
    if (input.status === "ARCHIVED") {
      assertPermission(context.membership, "clients:archive");
    }

    const updatedClient = await db.$transaction(async (transaction) => {
      const existing = await transaction.client.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const updated = await transaction.client.update({
        where: { id },
        data: input,
      });

      const changedFields = Object.keys(input);
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: input.status === "ARCHIVED" ? "client.archived" : "client.updated",
          entityType: "Client",
          entityId: id,
          metadata: { fields: changedFields },
        },
      });

      return updated;
    });

    return privateJson({ data: updatedClient });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    return jsonError(error);
  }
}
