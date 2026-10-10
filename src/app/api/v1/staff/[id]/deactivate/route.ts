import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    if (!hasValidOrigin(_request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const context = await resolveTenantContext();
    assertPermission(context.membership, "staff:deactivate");
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Staff record not found." }, { status: 404 });
    }
    const existing = await db.staffProfile.findFirst({
      where: { id, organisationId: context.organisation.id },
      select: { id: true, membershipUserId: true, employmentStatus: true },
    });
    if (!existing) return NextResponse.json({ error: "Staff record not found." }, { status: 404 });
    if (existing.employmentStatus === "INACTIVE") {
      return NextResponse.json({ error: "Staff member is already inactive." }, { status: 409 });
    }

    await db.$transaction(async (transaction) => {
      await transaction.staffProfile.update({
        where: { id_organisationId: { id, organisationId: context.organisation.id } },
        data: { employmentStatus: "INACTIVE" },
      });
      if (existing.membershipUserId) {
        await transaction.membership.updateMany({
          where: {
            userId: existing.membershipUserId,
            organisationId: context.organisation.id,
          },
          data: { active: false },
        });
      }
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "staff.deactivated",
          entityType: "StaffProfile",
          entityId: id,
        },
      });
    });
    return NextResponse.json({ data: { id, employmentStatus: "INACTIVE" } });
  } catch (error) {
    return jsonError(error);
  }
}
