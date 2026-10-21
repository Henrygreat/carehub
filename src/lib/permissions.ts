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
  | "attendance:record"
  // Phase 3: Care plan permissions
  | "carePlans:read"
  | "carePlans:create"
  | "carePlans:update"
  | "carePlans:archive"
  // Phase 3: Task completion
  | "tasks:complete"
  // Phase 3: Incident permissions
  | "incidents:read"
  | "incidents:create"
  | "incidents:update"
  | "incidents:review"
  // Phase 4: Availability permissions
  | "availability:read"
  | "availability:update"
  | "availability:manage"
  // Phase 4: Absence permissions
  | "absence:read"
  | "absence:request"
  | "absence:approve"
  // Phase 4: Scheduling permissions
  | "rota:read"
  | "rota:manage"
  | "scheduling:override"
  // Phase 4: Notification permissions
  | "notifications:read"
  // Phase 5: Branch permissions
  | "branches:read"
  | "branches:create"
  | "branches:update"
  | "branches:deactivate"
  | "branches:assign_staff";

// Phase 5: Platform-level permissions (separate from organisation permissions)
export type PlatformPermission =
  | "platform:organisations:read"
  | "platform:organisations:create"
  | "platform:organisations:update"
  | "platform:organisations:suspend"
  | "platform:organisations:reactivate"
  | "platform:organisations:invite"
  | "platform:audit:read";

const grants: Record<Role, readonly Permission[]> = {
  PLATFORM_ADMIN: [
    "organisation:read",
    "organisation:update",
    "staff:read",
    "clients:read",
    "visits:read",
    "shifts:read",
    "carePlans:read",
    "incidents:read",
    "branches:read",
  ],
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
    // Phase 3
    "carePlans:read",
    "carePlans:create",
    "carePlans:update",
    "carePlans:archive",
    "tasks:complete",
    "incidents:read",
    "incidents:create",
    "incidents:update",
    "incidents:review",
    // Phase 4
    "availability:read",
    "availability:update",
    "availability:manage",
    "absence:read",
    "absence:request",
    "absence:approve",
    "rota:read",
    "rota:manage",
    "scheduling:override",
    "notifications:read",
    // Phase 5: Branch management
    "branches:read",
    "branches:create",
    "branches:update",
    "branches:deactivate",
    "branches:assign_staff",
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
    // Phase 3
    "carePlans:read",
    "carePlans:create",
    "carePlans:update",
    "carePlans:archive",
    "tasks:complete",
    "incidents:read",
    "incidents:create",
    "incidents:update",
    "incidents:review",
    // Phase 4
    "availability:read",
    "availability:update",
    "availability:manage",
    "absence:read",
    "absence:request",
    "absence:approve",
    "rota:read",
    "rota:manage",
    "scheduling:override",
    "notifications:read",
    // Phase 5: Branch read
    "branches:read",
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
    // Phase 3: Coordinators can manage care plans and review incidents
    "carePlans:read",
    "carePlans:create",
    "carePlans:update",
    "tasks:complete",
    "incidents:read",
    "incidents:create",
    "incidents:update",
    "incidents:review",
    // Phase 4: Coordinators can manage rotas and approve leave
    "availability:read",
    "availability:manage",
    "absence:read",
    "absence:request",
    "absence:approve",
    "rota:read",
    "rota:manage",
    "scheduling:override",
    "notifications:read",
  ],
  CARE_WORKER: [
    "staff:read",
    // Phase 2: Care workers can view assigned clients and record attendance
    "clients:read",
    "visits:read",
    "shifts:read",
    "attendance:record",
    // Phase 3: Care workers can view care plans and complete tasks
    "carePlans:read",
    "tasks:complete",
    "incidents:read",
    "incidents:create",
    // Phase 4: Care workers can view their own rota and manage their availability
    "availability:read",
    "availability:update",
    "absence:read",
    "absence:request",
    "rota:read",
    "notifications:read",
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

// Phase 3: Care plan access control
// Care workers can only view care plans for clients they have visits assigned to
export function canAccessCarePlan(
  context: { membership: { role: Role }; assignedClientIds?: string[] },
  carePlan: { clientId: string },
) {
  if (context.membership.role === "CARE_WORKER") {
    // Care workers must have an assigned visit to this client
    return context.assignedClientIds?.includes(carePlan.clientId) ?? false;
  }
  return hasPermission(context.membership.role, "carePlans:read");
}

// Phase 3: Incident access control
// Care workers can view incidents they reported or are related to their visits
export function canAccessIncident(
  context: { membership: { role: Role; id: string }; staffProfileId?: string | null },
  incident: { reportedById: string; visitId?: string | null },
  visitStaffProfileId?: string | null,
) {
  if (context.membership.role === "CARE_WORKER") {
    // Care workers can see incidents they reported
    if (incident.reportedById === context.membership.id) return true;
    // Or incidents related to visits they're assigned to
    if (
      incident.visitId &&
      context.staffProfileId != null &&
      visitStaffProfileId === context.staffProfileId
    ) {
      return true;
    }
    return false;
  }
  return hasPermission(context.membership.role, "incidents:read");
}

// Phase 3: Check if user can review incidents
export function canReviewIncident(context: { membership: { role: Role } }) {
  return hasPermission(context.membership.role, "incidents:review");
}

export class PermissionDeniedError extends Error {
  constructor() {
    super("You do not have permission to perform this action.");
    this.name = "PermissionDeniedError";
  }
}

// =============================================================================
// Phase 5: Platform Admin Permission Functions
// =============================================================================

// All platform permissions granted to platform admins
const platformAdminPermissions: readonly PlatformPermission[] = [
  "platform:organisations:read",
  "platform:organisations:create",
  "platform:organisations:update",
  "platform:organisations:suspend",
  "platform:organisations:reactivate",
  "platform:organisations:invite",
  "platform:audit:read",
];

export function hasPlatformPermission(
  user: { isPlatformAdmin: boolean },
  permission: PlatformPermission,
): boolean {
  if (!user.isPlatformAdmin) return false;
  return platformAdminPermissions.includes(permission);
}

export function assertPlatformPermission(
  user: { isPlatformAdmin: boolean },
  permission: PlatformPermission,
): void {
  if (!hasPlatformPermission(user, permission)) {
    throw new PermissionDeniedError();
  }
}

export class PlatformAccessDeniedError extends Error {
  constructor() {
    super("Platform admin access required.");
    this.name = "PlatformAccessDeniedError";
  }
}

// Phase 5: Branch access control
export function canAccessBranch(
  context: { role: Role; organisationId: string },
  branch: { organisationId: string },
): boolean {
  if (branch.organisationId !== context.organisationId) return false;
  return hasPermission(context.role, "branches:read");
}
