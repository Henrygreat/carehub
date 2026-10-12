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
  | "users:role:assign"
  // Phase 2: Client permissions
  | "clients:read"
  | "clients:create"
  | "clients:update"
  | "clients:archive"
  // Phase 2: Visit permissions
  | "visits:read"
  | "visits:create"
  | "visits:update"
  | "visits:cancel"
  // Phase 2: Shift permissions
  | "shifts:read"
  | "shifts:create"
  | "shifts:update"
  | "shifts:cancel"
  // Phase 2: Attendance
  | "attendance:record";

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
    // Phase 2
    "clients:read",
    "clients:create",
    "clients:update",
    "clients:archive",
    "visits:read",
    "visits:create",
    "visits:update",
    "visits:cancel",
    "shifts:read",
    "shifts:create",
    "shifts:update",
    "shifts:cancel",
    "attendance:record",
  ],
  MANAGER: [
    "organisation:read",
    "staff:read",
    "staff:create",
    "staff:update",
    "staff:employment:read",
    "staff:employment:update",
    // Phase 2
    "clients:read",
    "clients:create",
    "clients:update",
    "clients:archive",
    "visits:read",
    "visits:create",
    "visits:update",
    "visits:cancel",
    "shifts:read",
    "shifts:create",
    "shifts:update",
    "shifts:cancel",
    "attendance:record",
  ],
  COORDINATOR: [
    "organisation:read",
    "staff:read",
    // Phase 2
    "clients:read",
    "visits:read",
    "visits:update",
    "shifts:read",
    "shifts:update",
    "attendance:record",
  ],
  CARE_WORKER: [
    "staff:read",
    // Phase 2: Care workers can view assigned clients and record attendance
    "clients:read",
    "visits:read",
    "shifts:read",
    "attendance:record",
  ],
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

// Phase 2: Client access control
// Care workers can only view clients they have visits assigned to
export function canAccessClient(
  context: { role: Role; organisationId: string },
  client: { organisationId: string },
) {
  if (client.organisationId !== context.organisationId) return false;
  return hasPermission(context.role, "clients:read");
}

// Phase 2: Visit access context type
export type VisitAccessContext = {
  membership: { role: Role; organisationId: string };
  staffProfileId?: string | null;
};

// Phase 2: Visit access control
// Care workers can only view their own assigned visits
export function canAccessVisit(
  context: VisitAccessContext,
  visit: { staffProfileId: string | null },
) {
  if (context.membership.role === "CARE_WORKER") {
    // Care workers must have a matching staffProfileId
    return context.staffProfileId != null && visit.staffProfileId === context.staffProfileId;
  }
  return hasPermission(context.membership.role, "visits:read");
}

// Phase 2: Shift access control
// Care workers can only view shifts they are assigned to
export function canAccessShift(
  context: VisitAccessContext,
  isAssigned: boolean,
) {
  if (context.membership.role === "CARE_WORKER") {
    return isAssigned;
  }
  return hasPermission(context.membership.role, "shifts:read");
}

// Check if user can record attendance for a visit/shift
export function canRecordAttendance(
  context: VisitAccessContext,
  visit: { staffProfileId: string | null },
) {
  // Coordinators, Managers, and Admins can record attendance for anyone
  if (context.membership.role !== "CARE_WORKER") {
    return hasPermission(context.membership.role, "attendance:record");
  }
  // Care workers can only record their own attendance
  return context.staffProfileId != null && visit.staffProfileId === context.staffProfileId;
}

export class PermissionDeniedError extends Error {
  constructor() {
    super("You do not have permission to perform this action.");
    this.name = "PermissionDeniedError";
  }
}
