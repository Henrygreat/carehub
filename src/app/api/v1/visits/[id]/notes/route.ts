import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { assertPermission, canAccessVisit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { careNoteSchema } from "@/lib/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "visits:read");

    const { id } = await params;

    // Look up staff profile for care workers
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

    const visit = await db.careVisit.findUnique({
      where: {
        id,
        organisationId: context.organisation.id,
      },
      select: {
        id: true,
        staffProfileId: true,
      },
    });

    if (!visit) {
      return NextResponse.json({ error: "Visit not found." }, { status: 404 });
    }

    // For care workers, verify they have access to this visit
    const accessContext = { membership: context.membership, staffProfileId };
    if (!canAccessVisit(accessContext, visit)) {
      return NextResponse.json({ error: "You are not assigned to this visit." }, { status: 403 });
    }

    const notes = await db.careNote.findMany({
      where: { visitId: id },
      select: {
        id: true,
        content: true,
        isIncident: true,
        isPrivate: true,
        createdAt: true,
        authorMembership: {
          select: {
            user: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter private notes for care workers - they can only see their own private notes
    const filteredNotes = context.membership.role === "CARE_WORKER"
      ? notes.filter(note => !note.isPrivate)
      : notes;

    return privateJson({ data: filteredNotes });
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
    assertPermission(context.membership, "attendance:record");

    const { id } = await params;
    const parsed = careNoteSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const input = parsed.data;

    // Look up staff profile for care workers
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

    const note = await db.$transaction(async (transaction) => {
      const visit = await transaction.careVisit.findUnique({
        where: {
          id,
          organisationId: context.organisation.id,
        },
        select: {
          id: true,
          clientId: true,
          staffProfileId: true,
        },
      });

      if (!visit) {
        throw new Error("NOT_FOUND");
      }

      // Verify care worker can add notes to this visit
      const accessContext = { membership: context.membership, staffProfileId };
      if (!canAccessVisit(accessContext, visit)) {
        throw new Error("NOT_AUTHORIZED");
      }

      const created = await transaction.careNote.create({
        data: {
          visitId: id,
          clientId: visit.clientId,
          organisationId: context.organisation.id,
          authorMembershipId: context.membership.id,
          content: input.content,
          isIncident: input.isIncident,
          isPrivate: input.isPrivate,
        },
      });

      const action = input.isIncident ? "visit.incident_reported" : "visit.note_added";

      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action,
          entityType: "CareNote",
          entityId: created.id,
          metadata: { visitId: id, clientId: visit.clientId, isIncident: input.isIncident },
        },
      });

      return created;
    });

    return NextResponse.json({ data: note }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Visit not found." }, { status: 404 });
      }
      if (error.message === "NOT_AUTHORIZED") {
        return NextResponse.json({ error: "You are not authorized to add notes to this visit." }, { status: 403 });
      }
    }
    return jsonError(error);
  }
}
