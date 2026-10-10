import type { Role } from "@prisma/client";
import type { Membership } from "@prisma/client";

export type Permission =
  | "organisation:read"
  | "organisation:update"
  | "staff:read"
  | "staff:create"
  | "staff:update"
  | "staff:employment:read"
  | "staff:employment:update"
  | "staff:deactivate"
  | "users:invite"
  | "users:role:assign";

const grants: Record<Role, readonly Permission[]> = {
  PLATFORM_ADMIN: ["organisation:read", "organisation:update"],
  ORG_ADMIN: [
    "organisation:read",
    "organisation:update",
    "staff:read",
    "staff:create",
    "staff:update",
    "staff:employment:read",
    "staff:employment:update",
    "staff:deactivate",
    "users:invite",
    "users:role:assign",
  ],
  MANAGER: [
    "organisation:read",
    "staff:read",
    "staff:create",
    "staff:update",
    "staff:employment:read",
    "staff:employment:update",
  ],
  COORDINATOR: ["organisation:read", "staff:read"],
  CARE_WORKER: ["staff:read"],
};

export function hasPermission(role: Role, permission: Permission) {
  return grants[role].includes(permission);
}

export function assertPermission(
  membership: Pick<Membership, "role">,
  permission: Permission,
) {
  if (!hasPermission(membership.role, permission)) {
    throw new PermissionDeniedError();
  }
}

export function canAccessStaffProfile(
  context: { role: Role; userId: string; organisationId: string },
  profile: { membershipUserId: string | null; organisationId: string },
) {
  if (profile.organisationId !== context.organisationId) return false;
  if (context.role === "CARE_WORKER") return profile.membershipUserId === context.userId;
  return hasPermission(context.role, "staff:read");
}

export class PermissionDeniedError extends Error {
  constructor() {
    super("You do not have permission to perform this action.");
    this.name = "PermissionDeniedError";
  }
}
