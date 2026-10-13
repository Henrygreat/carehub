import { IncidentCategory, IncidentSeverity, IncidentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { incidentSchema } from "@/lib/validation";

const INCIDENTS_PAGE_SIZE = 50;

// Generate incident reference
async function generateIncidentReference(organisationId: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");

  // Count existing incidents this month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const count = await db.incident.count({
    where: {
      organisationId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  const sequence = (count + 1).toString().padStart(4, "0");
  return `INC-${year}${month}-${sequence}`;
}

export async function GET(request: Request) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "incidents:read");

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const categoryParam = searchParams.get("category");
    const severityParam = searchParams.get("severity");
    const clientId = searchParams.get("clientId");
    const reportedById = searchParams.get("reportedById");

    // Parse filters
    let status: IncidentStatus | undefined;
    if (statusParam && Object.values(IncidentStatus).includes(statusParam as IncidentStatus)) {
      status = statusParam as IncidentStatus;
    }

    let category: IncidentCategory | undefined;
    if (categoryParam && Object.values(IncidentCategory).includes(categoryParam as IncidentCategory)) {
      category = categoryParam as IncidentCategory;
    }

    let severity: IncidentSeverity | undefined;
    if (severityParam && Object.values(IncidentSeverity).includes(severityParam as IncidentSeverity)) {
      severity = severityParam as IncidentSeverity;
    }

    // Build where clause
    const where: Prisma.IncidentWhereInput = {
      organisationId: context.organisation.id,
      ...(status && { status }),
      ...(category && { category }),
      ...(severity && { severity }),
      ...(clientId && { clientId }),
      ...(reportedById && { reportedById }),
    };

    // Care workers can only see incidents they reported or related to their visits
    if (context.membership.role === "CARE_WORKER") {
      const staffProfile = await db.staffProfile.findFirst({
        where: {
          membershipUserId: context.userId,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });

      if (staffProfile) {
        // Get visit IDs for this staff member
        const staffVisits = await db.careVisit.findMany({
          where: {
            staffProfileId: staffProfile.id,
            organisationId: context.organisation.id,
          },
          select: { id: true },
        });
        const staffVisitIds = staffVisits.map((v) => v.id);

        where.OR = [
          { reportedById: context.membership.id },
          { visitId: { in: staffVisitIds } },
        ];
      } else {
        // Only show incidents they reported
        where.reportedById = context.membership.id;
      }
    }

    const [total, data] = await db.$transaction([
      db.incident.count({ where }),
      db.incident.findMany({
        where,
        select: {
          id: true,
          incidentReference: true,
          category: true,
          severity: true,
          status: true,
          occurredAt: true,
          location: true,
          description: true,
          followUpRequired: true,
          createdAt: true,
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              clientReference: true,
            },
          },
          reportedBy: {
            select: {
              user: {
                select: { name: true },
              },
            },
          },
          reviewer: {
            select: {
              user: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: [
          { status: "asc" }, // Open first
          { severity: "desc" }, // Critical first
          { createdAt: "desc" },
        ],
        take: INCIDENTS_PAGE_SIZE,
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
    assertPermission(context.membership, "incidents:create");

    const parsed = incidentSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    // Validate client if provided
    if (input.clientId) {
      const client = await db.client.findUnique({
        where: {
          id: input.clientId,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ error: "Client not found." }, { status: 404 });
      }
    }

    // Validate visit if provided
    if (input.visitId) {
      const visit = await db.careVisit.findUnique({
        where: {
          id: input.visitId,
          organisationId: context.organisation.id,
        },
        select: { id: true },
      });
      if (!visit) {
        return NextResponse.json({ error: "Visit not found." }, { status: 404 });
      }
    }

    const incident = await db.$transaction(async (transaction) => {
      const incidentReference = await generateIncidentReference(context.organisation.id);

      const created = await transaction.incident.create({
        data: {
          organisationId: context.organisation.id,
          incidentReference,
          clientId: input.clientId ?? null,
          visitId: input.visitId ?? null,
          reportedById: context.membership.id,
          category: input.category,
          severity: input.severity,
          occurredAt: input.occurredAt,
          location: input.location ?? null,
          description: input.description,
          immediateAction: input.immediateAction ?? null,
          followUpRequired: input.followUpRequired,
        },
      });

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "incident.reported",
          entityType: "Incident",
          entityId: created.id,
          metadata: {
            category: input.category,
            severity: input.severity,
            clientId: input.clientId,
            visitId: input.visitId,
          },
        },
      });

      return created;
    });

    return NextResponse.json({ data: incident }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
