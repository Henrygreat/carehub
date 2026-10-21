import type { Session } from "next-auth";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PlatformAccessDeniedError } from "@/lib/permissions";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthenticationRequiredError";
  }
}

export type PlatformAdminContext = {
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    isPlatformAdmin: boolean;
  };
};

/**
 * Resolves and validates platform admin context.
 * Throws if user is not authenticated or not a platform admin.
 */
export async function resolvePlatformAdminContext(
  authenticatedSession?: Session | null,
): Promise<PlatformAdminContext> {
  const session =
    authenticatedSession === undefined ? await auth() : authenticatedSession;
  const userId = session?.user?.id;
  if (!userId) throw new AuthenticationRequiredError();

  const user = await db.user.findUnique({
    where: { id: userId, disabledAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      isPlatformAdmin: true,
    },
  });

  if (!user) throw new AuthenticationRequiredError();
  if (!user.isPlatformAdmin) throw new PlatformAccessDeniedError();

  return { userId, user };
}

/**
 * Creates a platform audit log entry.
 */
export async function createPlatformAuditLog(
  context: PlatformAdminContext,
  action: string,
  data: {
    entityType: string;
    entityId?: string;
    targetOrgId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await db.platformAuditLog.create({
    data: {
      actorUserId: context.userId,
      action,
      entityType: data.entityType,
      entityId: data.entityId,
      targetOrgId: data.targetOrgId,
      metadata: data.metadata as object | undefined,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    },
  });
}

/**
 * Extracts client IP address from request headers.
 */
export function getClientIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) ??
    request.headers.get("x-real-ip")?.slice(0, 64) ??
    undefined
  );
}

/**
 * Extracts user agent from request headers.
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get("user-agent")?.slice(0, 256) ?? undefined;
}
