"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  Play,
  Square,
  User,
  XCircle,
} from "lucide-react";

type EmergencyContact = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
};

type CareNote = {
  id: string;
  content: string;
  isIncident: boolean;
  isPrivate: boolean;
  createdAt: string;
  authorMembership: {
    user: { name: string };
  };
};

type CarePlanTask = {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  isRequired: boolean;
  carePlan: {
    id: string;
    title: string;
  };
};

type TaskCompletion = {
  id: string;
  taskId: string;
  completed: boolean;
  unableToComplete: boolean;
  notes: string | null;
  reason: string | null;
  completedAt: string | null;
  task: CarePlanTask;
  completedBy: {
    user: { name: string };
  };
};

type TaskCompletionData = {
  completions: TaskCompletion[];
  pendingTasks: CarePlanTask[];
};

type VisitData = {
  id: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string | null;
  actualEnd?: string | null;
  status: string;
  visitType?: string | null;
  notes?: string | null;
  cancellationNote?: string | null;
  createdAt: string;
  updatedAt?: string;
  client: {
    id: string;
    clientReference: string;
    firstName: string;
    lastName: string;
    preferredName?: string | null;
    phone?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    postcode?: string | null;
    careNotes?: string | null;
    emergencyContacts?: EmergencyContact[];
  };
  staffProfile?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
  } | null;
  careNotes?: CareNote[];
};

type CurrentUser = { role: string };

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  MISSED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

const statusLabel: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  MISSED: "Missed",
  CANCELLED: "Cancelled",
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VisitDetail({ id }: { id: string }) {
  const [visit, setVisit] = useState<VisitData>();
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteIsIncident, setNoteIsIncident] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [taskData, setTaskData] = useState<TaskCompletionData | null>(null);
  const [taskUpdates, setTaskUpdates] = useState<Record<string, { completed: boolean; unableToComplete: boolean; notes: string; reason: string }>>({});

  async function load() {
    setBusy(true);
    try {
      const [visitResponse, meResponse] = await Promise.all([
        fetch(`/api/v1/visits/${id}`),
        fetch("/api/v1/me"),
      ]);
      const [visitBody, meBody] = await Promise.all([visitResponse.json(), meResponse.json()]);
      if (!visitResponse.ok) throw new Error(visitBody.error ?? "Unable to load visit.");
      if (!meResponse.ok) throw new Error(meBody.error ?? "Unable to load your access details.");
      setVisit(visitBody.data);
      setRole((meBody.data as CurrentUser).role);
      setError("");

      // Load task completions if visit is in progress or completed
      if (["IN_PROGRESS", "COMPLETED"].includes(visitBody.data.status)) {
        try {
          const taskResponse = await fetch(`/api/v1/visits/${id}/task-completions`);
          if (taskResponse.ok) {
            const taskBody = await taskResponse.json();
            setTaskData(taskBody.data);
          }
        } catch {
          // Tasks are optional, don't fail the page load
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load visit.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTaskCompletions() {
    const completions = Object.entries(taskUpdates)
      .filter(([, update]) => update.completed || update.unableToComplete)
      .map(([taskId, update]) => ({
        taskId,
        completed: update.completed,
        unableToComplete: update.unableToComplete,
        notes: update.notes || null,
        reason: update.reason || null,
      }));

    if (completions.length === 0) return;

    setActionBusy(true);
    try {
      const response = await fetch(`/api/v1/visits/${id}/task-completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completions }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save task completions.");
      setTaskUpdates({});
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save task completions.");
    } finally {
      setActionBusy(false);
    }
  }

  function toggleTaskComplete(taskId: string, completed: boolean) {
    setTaskUpdates((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        completed,
        unableToComplete: completed ? false : prev[taskId]?.unableToComplete ?? false,
        notes: prev[taskId]?.notes ?? "",
        reason: prev[taskId]?.reason ?? "",
      },
    }));
  }

  function toggleTaskUnable(taskId: string, unable: boolean) {
    setTaskUpdates((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        completed: unable ? false : prev[taskId]?.completed ?? false,
        unableToComplete: unable,
        notes: prev[taskId]?.notes ?? "",
        reason: prev[taskId]?.reason ?? "",
      },
    }));
  }

  function updateTaskNotes(taskId: string, field: "notes" | "reason", value: string) {
    setTaskUpdates((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        completed: prev[taskId]?.completed ?? false,
        unableToComplete: prev[taskId]?.unableToComplete ?? false,
        notes: field === "notes" ? value : prev[taskId]?.notes ?? "",
        reason: field === "reason" ? value : prev[taskId]?.reason ?? "",
      },
    }));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function startVisit() {
    setActionBusy(true);
    try {
      const response = await fetch(`/api/v1/visits/${id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to start visit.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start visit.");
    } finally {
      setActionBusy(false);
    }
  }

  async function completeVisit() {
    setActionBusy(true);
    try {
      const response = await fetch(`/api/v1/visits/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to complete visit.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete visit.");
    } finally {
      setActionBusy(false);
    }
  }

  async function cancelVisit() {
    if (!cancelReason.trim()) {
      setError("Please provide a cancellation reason.");
      return;
    }
    setActionBusy(true);
    try {
      const response = await fetch(`/api/v1/visits/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancellationNote: cancelReason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to cancel visit.");
      setShowCancelModal(false);
      setCancelReason("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to cancel visit.");
    } finally {
      setActionBusy(false);
    }
  }

  async function addNote() {
    if (!noteContent.trim()) return;
    setActionBusy(true);
    try {
      const response = await fetch(`/api/v1/visits/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: noteContent,
          isIncident: noteIsIncident,
          isPrivate: false,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to add note.");
      setNoteContent("");
      setNoteIsIncident(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add note.");
    } finally {
      setActionBusy(false);
    }
  }

  if (busy) return <p className="py-12 text-center text-sm text-slate-500">Loading visit...</p>;
  if (error && !visit) return <div role="alert" className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">{error}</div>;
  if (!visit) return <div className="text-center text-slate-500">Visit not found.</div>;

  const canManage = ["ORG_ADMIN", "MANAGER", "COORDINATOR"].includes(role);
  const canRecordAttendance = role !== "PLATFORM_ADMIN";
  const address = [visit.client.addressLine1, visit.client.addressLine2, visit.client.city, visit.client.postcode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/visits" className="text-sm font-medium text-teal-700 hover:text-teal-900">
        ← Back to visits
      </Link>

      {error && (
        <div role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* Visit Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar size={16} />
              {formatDate(visit.scheduledDate)}
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              {visit.client.preferredName || visit.client.firstName} {visit.client.lastName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">Client ref: {visit.client.clientReference}</p>
          </div>
          <span
            className={`w-fit rounded-full border px-3 py-1 text-sm font-medium ${statusColors[visit.status] ?? "bg-slate-100 text-slate-600"}`}
          >
            {statusLabel[visit.status] ?? visit.status}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <Clock size={16} className="mt-0.5 text-slate-400" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scheduled time</dt>
              <dd className="mt-1 text-sm text-slate-900">
                {formatTime(visit.scheduledStart)} – {formatTime(visit.scheduledEnd)}
              </dd>
            </div>
          </div>
          {visit.visitType && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visit type</dt>
              <dd className="mt-1 text-sm text-slate-900">{visit.visitType}</dd>
            </div>
          )}
          {visit.staffProfile && (
            <div className="flex items-start gap-2">
              <User size={16} className="mt-0.5 text-slate-400" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned carer</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {visit.staffProfile.firstName} {visit.staffProfile.lastName}
                  {visit.staffProfile.phone && (
                    <span className="ml-2 text-slate-500">({visit.staffProfile.phone})</span>
                  )}
                </dd>
              </div>
            </div>
          )}
          {!visit.staffProfile && (
            <div className="flex items-start gap-2">
              <User size={16} className="mt-0.5 text-amber-500" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned carer</dt>
                <dd className="mt-1 text-sm text-amber-700 font-medium">Unassigned</dd>
              </div>
            </div>
          )}
          {address && (
            <div className="flex items-start gap-2 sm:col-span-2">
              <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</dt>
                <dd className="mt-1 text-sm text-slate-900">{address}</dd>
              </div>
            </div>
          )}
          {visit.actualStart && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actual start</dt>
              <dd className="mt-1 text-sm text-slate-900">{formatDateTime(visit.actualStart)}</dd>
            </div>
          )}
          {visit.actualEnd && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actual end</dt>
              <dd className="mt-1 text-sm text-slate-900">{formatDateTime(visit.actualEnd)}</dd>
            </div>
          )}
        </dl>

        {visit.notes && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visit notes</dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{visit.notes}</dd>
          </div>
        )}

        {visit.cancellationNote && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Cancellation reason</p>
            <p className="mt-1 text-sm text-rose-800">{visit.cancellationNote}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
          {visit.status === "SCHEDULED" && canRecordAttendance && (
            <button
              onClick={startVisit}
              disabled={actionBusy}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              <Play size={16} /> Start visit
            </button>
          )}
          {visit.status === "IN_PROGRESS" && canRecordAttendance && (
            <button
              onClick={completeVisit}
              disabled={actionBusy}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              <CheckCircle size={16} /> Complete visit
            </button>
          )}
          {["SCHEDULED", "IN_PROGRESS"].includes(visit.status) && canManage && (
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={actionBusy}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              <XCircle size={16} /> Cancel visit
            </button>
          )}
          {canManage && visit.status !== "CANCELLED" && visit.status !== "COMPLETED" && (
            <Link
              href={`/visits/${id}/edit`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit visit
            </Link>
          )}
        </div>
      </section>

      {/* Client Care Notes */}
      {visit.client.careNotes && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <AlertTriangle size={18} className="text-amber-500" />
            Client care information
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{visit.client.careNotes}</p>
        </section>
      )}

      {/* Emergency Contacts */}
      {visit.client.emergencyContacts && visit.client.emergencyContacts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Emergency contacts</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {visit.client.emergencyContacts.map((contact) => (
              <div key={contact.id} className="flex items-start justify-between py-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {contact.name}
                    {contact.isPrimary && (
                      <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                        Primary
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{contact.relationship}</p>
                </div>
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-900"
                >
                  <Phone size={14} /> {contact.phone}
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Care Plan Tasks */}
      {taskData && (taskData.pendingTasks.length > 0 || taskData.completions.length > 0) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <ClipboardList size={18} />
            Care plan tasks
          </h2>

          {/* Pending Tasks */}
          {taskData.pendingTasks.length > 0 && canRecordAttendance && visit.status !== "CANCELLED" && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-700">Tasks to complete</h3>
              <div className="mt-2 space-y-3">
                {taskData.pendingTasks.map((task) => {
                  const update = taskUpdates[task.id] || { completed: false, unableToComplete: false, notes: "", reason: "" };
                  return (
                    <div key={task.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{task.title}</span>
                            {task.isRequired && (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                                Required
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="mt-1 text-sm text-slate-600">{task.description}</p>
                          )}
                          <p className="mt-1 text-xs text-slate-500">
                            From: {task.carePlan.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleTaskComplete(task.id, !update.completed)}
                            className={`p-2 rounded-lg border transition ${
                              update.completed
                                ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                                : "bg-white border-slate-300 text-slate-400 hover:text-emerald-600 hover:border-emerald-300"
                            }`}
                            title="Mark as completed"
                          >
                            <CheckCircle size={20} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleTaskUnable(task.id, !update.unableToComplete)}
                            className={`p-2 rounded-lg border transition ${
                              update.unableToComplete
                                ? "bg-amber-100 border-amber-300 text-amber-700"
                                : "bg-white border-slate-300 text-slate-400 hover:text-amber-600 hover:border-amber-300"
                            }`}
                            title="Unable to complete"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      </div>
                      {(update.completed || update.unableToComplete) && (
                        <div className="mt-3 space-y-2">
                          {update.unableToComplete && (
                            <input
                              type="text"
                              placeholder="Reason for not completing..."
                              value={update.reason}
                              onChange={(e) => updateTaskNotes(task.id, "reason", e.target.value)}
                              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                            />
                          )}
                          <input
                            type="text"
                            placeholder="Optional notes..."
                            value={update.notes}
                            onChange={(e) => updateTaskNotes(task.id, "notes", e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {Object.values(taskUpdates).some((u) => u.completed || u.unableToComplete) && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={saveTaskCompletions}
                    disabled={actionBusy}
                    className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                  >
                    Save task progress
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Completed Tasks */}
          {taskData.completions.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-700">Completed tasks</h3>
              <div className="mt-2 divide-y divide-slate-100">
                {taskData.completions.map((completion) => (
                  <div key={completion.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {completion.completed ? (
                          <CheckCircle size={18} className="text-emerald-600" />
                        ) : completion.unableToComplete ? (
                          <XCircle size={18} className="text-amber-600" />
                        ) : (
                          <Square size={18} className="text-slate-400" />
                        )}
                        <span className="font-medium text-slate-900">{completion.task.title}</span>
                        {completion.task.isRequired && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                            Required
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {completion.completedBy.user.name}
                      </span>
                    </div>
                    {(completion.notes || completion.reason) && (
                      <p className="mt-1 ml-7 text-sm text-slate-600">
                        {completion.reason && <span className="font-medium">Reason: </span>}
                        {completion.reason || completion.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {taskData.pendingTasks.length === 0 && taskData.completions.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">No care plan tasks for this client.</p>
          )}
        </section>
      )}

      {/* Visit Notes / Care Notes */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <MessageSquare size={18} />
          Visit notes
        </h2>

        {/* Add Note Form */}
        {canRecordAttendance && visit.status !== "CANCELLED" && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <textarea
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
              rows={3}
              placeholder="Add a note about this visit..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />
            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={noteIsIncident}
                  onChange={(e) => setNoteIsIncident(e.target.checked)}
                  className="size-4 rounded border-slate-300"
                />
                Flag as incident/concern
              </label>
              <button
                onClick={addNote}
                disabled={actionBusy || !noteContent.trim()}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                Add note
              </button>
            </div>
          </div>
        )}

        {/* Notes List */}
        {visit.careNotes && visit.careNotes.length > 0 ? (
          <div className="mt-4 divide-y divide-slate-100">
            {visit.careNotes.map((note) => (
              <div key={note.id} className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{note.authorMembership.user.name}</span>
                    {note.isIncident && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                        Incident
                      </span>
                    )}
                    {note.isPrivate && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Private
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{formatDateTime(note.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{note.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No notes recorded for this visit.</p>
        )}
      </section>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Cancel visit</h3>
            <p className="mt-2 text-sm text-slate-600">
              Please provide a reason for cancelling this visit.
            </p>
            <textarea
              className="mt-4 w-full rounded-lg border border-slate-300 p-3 text-sm"
              rows={3}
              placeholder="Cancellation reason..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep visit
              </button>
              <button
                onClick={cancelVisit}
                disabled={actionBusy || !cancelReason.trim()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Cancel visit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
