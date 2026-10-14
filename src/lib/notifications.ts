import { db } from "@/lib/db";
import type { NotificationType } from "@prisma/client";

export type NotificationPayload = {
  organisationId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl?: string;
  linkLabel?: string;
  entityType?: string;
  entityId?: string;
};

// Create a single notification
export async function createNotification(payload: NotificationPayload) {
  return db.notification.create({
    data: {
      organisationId: payload.organisationId,
      recipientId: payload.recipientId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      linkUrl: payload.linkUrl,
      linkLabel: payload.linkLabel,
      entityType: payload.entityType,
      entityId: payload.entityId,
    },
  });
}

// Create notifications for multiple recipients
export async function createNotifications(payloads: NotificationPayload[]) {
  return db.notification.createMany({
    data: payloads.map((p) => ({
      organisationId: p.organisationId,
      recipientId: p.recipientId,
      type: p.type,
      title: p.title,
      message: p.message,
      linkUrl: p.linkUrl,
      linkLabel: p.linkLabel,
      entityType: p.entityType,
      entityId: p.entityId,
    })),
  });
}

// Notify staff of new assignment
export async function notifyNewAssignment(
  organisationId: string,
  staffMembershipId: string,
  visitId: string,
  clientName: string,
  dateStr: string,
  timeStr: string,
) {
  await createNotification({
    organisationId,
    recipientId: staffMembershipId,
    type: "ASSIGNMENT_NEW",
    title: "New visit assigned",
    message: `You have been assigned a visit with ${clientName} on ${dateStr} at ${timeStr}`,
    linkUrl: `/visits/${visitId}`,
    linkLabel: "View visit",
    entityType: "CareVisit",
    entityId: visitId,
  });
}

// Notify staff of assignment change
export async function notifyAssignmentChanged(
  organisationId: string,
  staffMembershipId: string,
  visitId: string,
  clientName: string,
  changeDescription: string,
) {
  await createNotification({
    organisationId,
    recipientId: staffMembershipId,
    type: "ASSIGNMENT_CHANGED",
    title: "Visit updated",
    message: `Your visit with ${clientName} has been updated: ${changeDescription}`,
    linkUrl: `/visits/${visitId}`,
    linkLabel: "View visit",
    entityType: "CareVisit",
    entityId: visitId,
  });
}

// Notify staff of cancelled assignment
export async function notifyAssignmentCancelled(
  organisationId: string,
  staffMembershipId: string,
  clientName: string,
  dateStr: string,
) {
  await createNotification({
    organisationId,
    recipientId: staffMembershipId,
    type: "ASSIGNMENT_CANCELLED",
    title: "Visit cancelled",
    message: `Your visit with ${clientName} on ${dateStr} has been cancelled`,
  });
}

// Notify coordinators of unassigned visit
export async function notifyUnassignedVisit(
  organisationId: string,
  coordinatorMembershipIds: string[],
  visitId: string,
  clientName: string,
  dateStr: string,
) {
  const payloads: NotificationPayload[] = coordinatorMembershipIds.map((recipientId) => ({
    organisationId,
    recipientId,
    type: "VISIT_UNASSIGNED" as NotificationType,
    title: "Unassigned visit",
    message: `Visit with ${clientName} on ${dateStr} needs to be assigned`,
    linkUrl: `/visits/${visitId}`,
    linkLabel: "View visit",
    entityType: "CareVisit",
    entityId: visitId,
  }));

  await createNotifications(payloads);
}

// Notify coordinators of missed visit
export async function notifyMissedVisit(
  organisationId: string,
  coordinatorMembershipIds: string[],
  visitId: string,
  clientName: string,
  staffName: string,
) {
  const payloads: NotificationPayload[] = coordinatorMembershipIds.map((recipientId) => ({
    organisationId,
    recipientId,
    type: "VISIT_MISSED" as NotificationType,
    title: "Missed visit alert",
    message: `${staffName}'s visit with ${clientName} was missed`,
    linkUrl: `/visits/${visitId}`,
    linkLabel: "View visit",
    entityType: "CareVisit",
    entityId: visitId,
  }));

  await createNotifications(payloads);
}

// Notify staff of leave request decision
export async function notifyLeaveDecision(
  organisationId: string,
  staffMembershipId: string,
  absenceId: string,
  approved: boolean,
  dateRange: string,
) {
  await createNotification({
    organisationId,
    recipientId: staffMembershipId,
    type: approved ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
    title: approved ? "Leave approved" : "Leave request declined",
    message: approved
      ? `Your leave request for ${dateRange} has been approved`
      : `Your leave request for ${dateRange} has been declined`,
    linkUrl: `/staff/me/absences`,
    linkLabel: "View absences",
    entityType: "StaffAbsence",
    entityId: absenceId,
  });
}

// Notify coordinators of new leave request
export async function notifyLeaveRequest(
  organisationId: string,
  coordinatorMembershipIds: string[],
  absenceId: string,
  staffName: string,
  dateRange: string,
  leaveType: string,
) {
  const payloads: NotificationPayload[] = coordinatorMembershipIds.map((recipientId) => ({
    organisationId,
    recipientId,
    type: "LEAVE_REQUESTED" as NotificationType,
    title: "Leave request",
    message: `${staffName} has requested ${leaveType.toLowerCase().replace("_", " ")} for ${dateRange}`,
    linkUrl: `/absences/${absenceId}`,
    linkLabel: "Review request",
    entityType: "StaffAbsence",
    entityId: absenceId,
  }));

  await createNotifications(payloads);
}

// Mark notifications as read
export async function markNotificationsRead(
  recipientId: string,
  notificationIds: string[],
) {
  await db.notification.updateMany({
    where: {
      recipientId,
      id: { in: notificationIds },
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

// Get unread notification count
export async function getUnreadCount(recipientId: string): Promise<number> {
  return db.notification.count({
    where: {
      recipientId,
      isRead: false,
    },
  });
}

// Get coordinator membership IDs for an organisation
export async function getCoordinatorMembershipIds(
  organisationId: string,
): Promise<string[]> {
  const memberships = await db.membership.findMany({
    where: {
      organisationId,
      active: true,
      role: { in: ["ORG_ADMIN", "MANAGER", "COORDINATOR"] },
    },
    select: { id: true },
  });
  return memberships.map((m) => m.id);
}
