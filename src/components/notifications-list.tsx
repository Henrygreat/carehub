"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Palmtree,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  entityType: string | null;
  entityId: string | null;
  linkUrl: string | null;
};

type NotificationsResponse = {
  data: Notification[];
  pagination: {
    total: number;
    unread: number;
    offset: number;
    pageSize: number;
  };
};

const typeIcons: Record<string, React.ReactNode> = {
  NEW_ASSIGNMENT: <Calendar size={18} className="text-teal-600" />,
  ASSIGNMENT_CHANGED: <Clock size={18} className="text-blue-600" />,
  ASSIGNMENT_CANCELLED: <XCircle size={18} className="text-rose-600" />,
  UNASSIGNED_VISIT: <AlertCircle size={18} className="text-amber-600" />,
  MISSED_VISIT: <AlertCircle size={18} className="text-rose-600" />,
  LEAVE_APPROVED: <CheckCircle2 size={18} className="text-emerald-600" />,
  LEAVE_REJECTED: <XCircle size={18} className="text-rose-600" />,
  LEAVE_REQUEST: <Palmtree size={18} className="text-amber-600" />,
  INCIDENT_CREATED: <AlertCircle size={18} className="text-rose-600" />,
  CARE_PLAN_UPDATED: <FileText size={18} className="text-blue-600" />,
  SHIFT_REMINDER: <Clock size={18} className="text-teal-600" />,
  SYSTEM: <Bell size={18} className="text-slate-600" />,
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function NotificationsList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<NotificationsResponse["pagination"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const fetchNotifications = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ offset: String(offset) });
      if (unreadOnly) params.set("unreadOnly", "true");

      const response = await fetch(`/api/v1/notifications?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load notifications.");

      setNotifications(body.data);
      setPagination(body.pagination);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markAsRead(notificationIds: string[]) {
    try {
      const response = await fetch("/api/v1/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            notificationIds.includes(n.id) ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          )
        );
        if (pagination) {
          setPagination({ ...pagination, unread: pagination.unread - notificationIds.length });
        }
      }
    } catch {
      // Silently fail
    }
  }

  async function markAllAsRead() {
    setMarkingAllRead(true);
    try {
      const response = await fetch("/api/v1/notifications?action=markAllRead", {
        method: "POST",
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
        if (pagination) {
          setPagination({ ...pagination, unread: 0 });
        }
      }
    } catch {
      // Silently fail
    } finally {
      setMarkingAllRead(false);
    }
  }

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markAsRead([notification.id]);
    }
  }

  function getNotificationLink(notification: Notification): string | null {
    if (notification.linkUrl) return notification.linkUrl;
    if (notification.entityType && notification.entityId) {
      switch (notification.entityType) {
        case "CareVisit":
          return `/visits/${notification.entityId}`;
        case "Shift":
          return `/shifts/${notification.entityId}`;
        case "StaffAbsence":
          return `/staff/absences/${notification.entityId}`;
        case "Incident":
          return `/incidents/${notification.entityId}`;
        case "CarePlan":
          return `/care-plans/${notification.entityId}`;
        default:
          return null;
      }
    }
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border border-slate-300 p-1">
            <button
              onClick={() => setUnreadOnly(false)}
              className={`rounded px-3 py-1 text-sm font-medium transition ${
                !unreadOnly ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setUnreadOnly(true)}
              className={`rounded px-3 py-1 text-sm font-medium transition ${
                unreadOnly ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Unread{pagination?.unread ? ` (${pagination.unread})` : ""}
            </button>
          </div>

          <button
            onClick={() => fetchNotifications()}
            className="flex items-center gap-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {pagination && pagination.unread > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={markingAllRead}
            className="text-sm font-medium text-teal-700 hover:text-teal-800 disabled:opacity-50"
          >
            {markingAllRead ? "Marking..." : "Mark all as read"}
          </button>
        )}
      </div>

      {/* Notifications list */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <div role="alert" className="p-8 text-center text-sm text-rose-700">
            {error}
          </div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-10 text-center">
            <Bell size={40} className="mx-auto text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">
              {unreadOnly ? "No unread notifications" : "No notifications yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notification) => {
              const link = getNotificationLink(notification);
              const content = (
                <div
                  className={`flex gap-4 p-4 transition ${
                    notification.isRead ? "bg-white" : "bg-teal-50/50"
                  } ${link ? "hover:bg-slate-50 cursor-pointer" : ""}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="shrink-0 pt-0.5">
                    {typeIcons[notification.type] ?? <Bell size={18} className="text-slate-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${notification.isRead ? "text-slate-700" : "font-medium text-slate-900"}`}>
                        {notification.title}
                      </p>
                      <span className="shrink-0 text-xs text-slate-500">{formatTimeAgo(notification.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{notification.message}</p>
                    {!notification.isRead && (
                      <span className="mt-2 inline-block h-2 w-2 rounded-full bg-teal-500" aria-label="Unread" />
                    )}
                  </div>
                </div>
              );

              if (link) {
                return (
                  <Link key={notification.id} href={link}>
                    {content}
                  </Link>
                );
              }

              return <div key={notification.id}>{content}</div>;
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total > pagination.pageSize && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">
              Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.pageSize, pagination.total)} of{" "}
              {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchNotifications(Math.max(0, pagination.offset - pagination.pageSize))}
                disabled={pagination.offset === 0}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchNotifications(pagination.offset + pagination.pageSize)}
                disabled={pagination.offset + pagination.pageSize >= pagination.total}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
