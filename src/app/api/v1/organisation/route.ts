import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { organisationSchema } from "@/lib/validation";

export async function GET() {
  try {
    const context = await resolveTenantContext();
    assertPermission(context.membership, "organisation:read");
    return privateJson({
      data: {
        id: context.organisation.id,
        name: context.organisation.name,
        slug: context.organisation.slug,
        brandName: context.organisation.brandName,
        brandColour: context.organisation.brandColour,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const context = await resolveTenantContext();
    assertPermission(context.membership, "organisation:update");
    const parsed = organisationSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten());

    const updated = await db.$transaction(async (transaction) => {
      const organisation = await transaction.organisation.update({
        where: { id: context.organisation.id },
        data: parsed.data,
        select: { id: true, name: true, slug: true, brandName: true, brandColour: true },
      });
      await transaction.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "organisation.updated",
          entityType: "Organisation",
          entityId: organisation.id,
          metadata: { fields: Object.keys(parsed.data) },
        },
      });
      return organisation;
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return jsonError(error);
  }
}
