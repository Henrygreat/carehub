import { jsonError, privateJson } from "@/lib/api";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";

export async function GET() {
  try {
    const context = await resolveTenantContext();
    const user = await db.user.findUniqueOrThrow({
      where: { id: context.userId },
      select: { id: true, name: true, email: true },
    });
    return privateJson({
      data: {
        ...user,
        role: context.membership.role,
        organisation: {
          id: context.organisation.id,
          name: context.organisation.name,
          brandName: context.organisation.brandName,
        },
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
