import { ClientStatus, Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { clientSchema } from "@/lib/validation";

const CLIENT_PAGE_SIZE = 20;

function clientSelectFields(role: Role) {
  // Care workers see limited fields
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
    } as const;
  }
  // Coordinators and above see all client details
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
  } as const;
}

export async function GET(request: Request) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "clients:read");

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim().slice(0, 100) ?? "";
    const statusValue = searchParams.get("status");

    if (
      statusValue &&
      !Object.values(ClientStatus).includes(statusValue as ClientStatus)
    ) {
      return validationError({ status: ["Invalid client status."] });
    }

    const status = Object.values(ClientStatus).includes(statusValue as ClientStatus)
      ? (statusValue as ClientStatus)
      : undefined;

    const pageParameter = searchParams.get("page") ?? "1";
    if (!/^[1-9]\d{0,6}$/.test(pageParameter)) {
      return validationError({ page: ["Page must be a positive integer."] });
    }
    const page = Number.parseInt(pageParameter, 10);
    const skip = (page - 1) * CLIENT_PAGE_SIZE;

    // Build where clause
    const where: Prisma.ClientWhereInput = {
      organisationId: context.organisation.id,
      ...(status ? { status } : { status: { not: "ARCHIVED" } }), // Don't show archived by default
    };

    // Add search query
    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { clientReference: { contains: query, mode: "insensitive" } },
        { postcode: { contains: query, mode: "insensitive" } },
      ];
    }

    const [total, data] = await db.$transaction([
      db.client.count({ where }),
      db.client.findMany({
        where,
        select: clientSelectFields(context.membership.role),
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip,
        take: CLIENT_PAGE_SIZE,
      }),
    ]);

    return privateJson({
      data,
      pagination: {
        page,
        pageSize: CLIENT_PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / CLIENT_PAGE_SIZE),
      },
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
    assertPermission(context.membership, "clients:create");

    const parsed = clientSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    const client = await db.$transaction(async (transaction) => {
      const created = await transaction.client.create({
        data: {
          ...input,
          organisationId: context.organisation.id,
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "client.created",
          entityType: "Client",
          entityId: created.id,
        },
      });

      return created;
    });

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
