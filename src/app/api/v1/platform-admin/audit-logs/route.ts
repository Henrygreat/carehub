import { jsonError, privateJson } from "@/lib/api";
import { db } from "@/lib/db";
import { assertPlatformPermission } from "@/lib/permissions";
import { resolvePlatformAdminContext } from "@/lib/platform-admin";

/**
 * GET /api/v1/platform-admin/audit-logs
 * List platform audit logs (platform admin only)
 */
export async function GET(request: Request) {
  try {
    const context = await resolvePlatformAdminContext();
    assertPlatformPermission(context.user, "platform:audit:read");

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const action = url.searchParams.get("action");
    const targetOrgId = url.searchParams.get("organisationId");

    const auditLogs = await db.platformAuditLog.findMany({
      where: {
        ...(action ? { action: { contains: action } } : {}),
        ...(targetOrgId ? { targetOrgId } : {}),
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        targetOrgId: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await db.platformAuditLog.count({
      where: {
        ...(action ? { action: { contains: action } } : {}),
        ...(targetOrgId ? { targetOrgId } : {}),
      },
    });

    return privateJson({
      data: auditLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + auditLogs.length < total,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
