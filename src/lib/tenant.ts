import { headers } from "next/headers";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export class AuthenticationRequiredError extends Error {}
export class TenantAccessError extends Error {}

export async function resolveTenantContext(
  authenticatedSession?: Session | null,
) {
  const session =
    authenticatedSession === undefined ? await auth() : authenticatedSession;
  const userId = session?.user?.id;
  if (!userId) throw new AuthenticationRequiredError();

  const requestHeaders = await headers();
  const requestedOrganisation = requestHeaders.get("x-active-organisation");
  if (
    requestedOrganisation &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestedOrganisation,
    )
  ) {
    throw new TenantAccessError();
  }
  const membership = await db.membership.findFirst({
    where: {
      userId,
      active: true,
      user: { disabledAt: null },
      ...(requestedOrganisation ? { organisationId: requestedOrganisation } : {}),
    },
    include: { organisation: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new TenantAccessError();

  return { userId, membership, organisation: membership.organisation };
}
