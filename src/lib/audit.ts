import { db } from "@/lib/db";

type AuditEvent = {
  organisationId: string;
  actorUserId?: string;
  actorMembershipId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export function recordAuditEvent(event: AuditEvent) {
  return db.auditLog.create({
    data: {
      ...event,
      metadata: event.metadata ?? undefined,
    },
  });
}
