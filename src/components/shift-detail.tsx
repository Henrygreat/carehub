"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle,
  Clock,
  MapPin,
  MessageSquare,
  Play,
  Plus,
  Trash2,
  User,
  XCircle,
} from "lucide-react";

type StaffProfile = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
};

type ShiftAssignment = {
  id: string;
  staffProfileId: string;
  actualStart?: string | null;
  actualEnd?: string | null;
  status: string;
  notes?: string | null;
  staffProfile: StaffProfile;
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

type ShiftData = {
  id: string;
  shiftReference: string;
  locationName: string;
  locationAddress?: string | null;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  isOvernight: boolean;
  notes?: string | null;
  cancellationNote?: string | null;
  createdAt: string;
  updatedAt?: string;
  assignments: ShiftAssignment[];
  careNotes?: CareNote[];
};

type CurrentUser = { role: string };

type AvailableStaff = {
  id: string;
  firstName: string;
  lastName: string;
};

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

const statusLabel: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

export function ShiftDetail({ id }: { id: string }) {
  const [shift, setShift] = useState<ShiftData>();
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");

  async function load() {
    setBusy(true);
    try {
      const [shiftResponse, meResponse] = await Promise.all([
        fetch(`/api/v1/shifts/${id}`),
        fetch("/api/v1/me"),
      ]);
      const [shiftBody, meBody] = await Promise.all([
        shiftResponse.json(),
        meResponse.json(),
      ]);
      if (!shiftResponse.ok) throw new Error(shiftBody.error ?? "Unable to load shift.");
      if (!meResponse.ok)
        throw new Error(meBody.error ?? "Unable to load your access details.");
      setShift(shiftBody.data);
      setRole((meBody.data as CurrentUser).role);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load shift.");
    } finally {
      setBusy(false);
    }
  }

  async function loadAvailableStaff() {
    try {
      const response = await fetch("/api/v1/staff");
      const body = await response.json();
      if (response.ok) {
        const activeStaff = body.data.filter(
          (s: AvailableStaff & { employmentStatus: string }) =>
            s.employmentStatus === "ACTIVE"
        );
        // Filter out already assigned staff
        const assignedIds = new Set(shift?.assignments.map((a) => a.staffProfileId) ?? []);
        setAvailableStaff(activeStaff.filter((s: AvailableStaff) => !assignedIds.has(s.id)));
      }
    } catch {
      // Silent fail
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function startShift() {
    setActionBusy(true);
    try {
      const response = await fetch(`/api/v1/shifts/${id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to start shift.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start shift.");
    } finally {
      setActionBusy(false);
    }
  }

  async function completeShift() {
    setActionBusy(true);
    try {
      const response = await fetch(`/api/v1/shifts/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to complete shift.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete shift.");
    } finally {
      setActionBusy(false);
    }
  }

  async function cancelShift() {
    if (!cancelReason.trim()) {
      setError("Please provide a cancellation reason.");
      return;
    }
    setActionBusy(true);
    try {
      const response = await fetch(`/api/v1/shifts/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancellationNote: cancelReason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to cancel shift.");
      setShowCancelModal(false);
      setCancelReason("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to cancel shift.");
    } finally {
      setActionBusy(false);
    }
  }

  async function assignStaff() {
    if (!selectedStaff) return;
    setActionBusy(true);
    try {
      const response = await fetch(`/api/v1/shifts/${id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffProfileId: selectedStaff }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to assign staff.");
      setShowAssignModal(false);
      setSelectedStaff("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to assign staff.");
    } finally {
      setActionBusy(false);
    }
  }

  async function removeAssignment(assignmentId: string) {
    if (!window.confirm("Remove this staff member from the shift?")) return;
    setActionBusy(true);
    try {
      const response = await fetch(`/api/v1/shifts/${id}/assignments/${assignmentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Unable to remove assignment.");
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to remove assignment.");
    } finally {
      setActionBusy(false);
    }
  }

  if (busy)
    return <p className="py-12 text-center text-sm text-slate-500">Loading shift...</p>;
  if (error && !shift)
    return (
      <div role="alert" className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">
        {error}
      </div>
    );
  if (!shift) return <div className="text-center text-slate-500">Shift not found.</div>;

  const canManage = ["ORG_ADMIN", "MANAGER"].includes(role);
  const canRecordAttendance = role !== "PLATFORM_ADMIN";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/shifts" className="text-sm font-medium text-teal-700 hover:text-teal-900">
        ← Back to shifts
      </Link>

      {error && (
        <div role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* Shift Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-medium text-teal-700">{shift.shiftReference}</p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-slate-900">
              <MapPin size={20} className="text-slate-400" />
              {shift.locationName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{formatDate(shift.scheduledDate)}</p>
          </div>
          <span
            className={`w-fit rounded-full border px-3 py-1 text-sm font-medium ${statusColors[shift.status] ?? "bg-slate-100 text-slate-600"}`}
          >
            {statusLabel[shift.status] ?? shift.status}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <Clock size={16} className="mt-0.5 text-slate-400" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Scheduled time
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {formatTime(shift.scheduledStart)} – {formatTime(shift.scheduledEnd)}
                {shift.isOvernight && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    Overnight
                  </span>
                )}
              </dd>
            </div>
          </div>
          {shift.locationAddress && (
            <div className="flex items-start gap-2 sm:col-span-2">
              <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Address
                </dt>
                <dd className="mt-1 text-sm text-slate-900">{shift.locationAddress}</dd>
              </div>
            </div>
          )}
        </dl>

        {shift.notes && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Shift notes
            </dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{shift.notes}</dd>
          </div>
        )}

        {shift.cancellationNote && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
              Cancellation reason
            </p>
            <p className="mt-1 text-sm text-rose-800">{shift.cancellationNote}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
          {shift.status === "SCHEDULED" && canRecordAttendance && (
            <button
              onClick={startShift}
              disabled={actionBusy}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              <Play size={16} /> Start shift
            </button>
          )}
          {shift.status === "IN_PROGRESS" && canRecordAttendance && (
            <button
              onClick={completeShift}
              disabled={actionBusy}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              <CheckCircle size={16} /> Complete shift
            </button>
          )}
          {["SCHEDULED", "IN_PROGRESS"].includes(shift.status) && canManage && (
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={actionBusy}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              <XCircle size={16} /> Cancel shift
            </button>
          )}
          {canManage && shift.status !== "CANCELLED" && shift.status !== "COMPLETED" && (
            <Link
              href={`/shifts/${id}/edit`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit shift
            </Link>
          )}
        </div>
      </section>

      {/* Staff Assignments */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <User size={18} />
            Assigned staff
          </h2>
          {canManage && shift.status !== "CANCELLED" && shift.status !== "COMPLETED" && (
            <button
              onClick={() => {
                loadAvailableStaff();
                setShowAssignModal(true);
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-900"
            >
              <Plus size={16} /> Assign staff
            </button>
          )}
        </div>

        {shift.assignments.length === 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">No staff assigned to this shift.</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {shift.assignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {assignment.staffProfile.firstName} {assignment.staffProfile.lastName}
                  </p>
                  {assignment.staffProfile.phone && (
                    <p className="mt-0.5 text-sm text-slate-500">{assignment.staffProfile.phone}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-medium ${statusColors[assignment.status]}`}
                    >
                      {statusLabel[assignment.status]}
                    </span>
                    {assignment.actualStart && (
                      <span className="text-slate-500">
                        Started: {formatDateTime(assignment.actualStart)}
                      </span>
                    )}
                    {assignment.actualEnd && (
                      <span className="text-slate-500">
                        Ended: {formatDateTime(assignment.actualEnd)}
                      </span>
                    )}
                  </div>
                </div>
                {canManage && shift.status !== "CANCELLED" && shift.status !== "COMPLETED" && (
                  <button
                    onClick={() => removeAssignment(assignment.id)}
                    disabled={actionBusy}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50"
                    title="Remove assignment"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Shift Notes */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <MessageSquare size={18} />
          Shift notes
        </h2>

        {shift.careNotes && shift.careNotes.length > 0 ? (
          <div className="mt-4 divide-y divide-slate-100">
            {shift.careNotes.map((note) => (
              <div key={note.id} className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {note.authorMembership.user.name}
                    </span>
                    {note.isIncident && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                        Incident
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
          <p className="mt-4 text-sm text-slate-500">No notes recorded for this shift.</p>
        )}
      </section>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Cancel shift</h3>
            <p className="mt-2 text-sm text-slate-600">
              Please provide a reason for cancelling this shift.
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
                Keep shift
              </button>
              <button
                onClick={cancelShift}
                disabled={actionBusy || !cancelReason.trim()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Cancel shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Assign staff</h3>
            <p className="mt-2 text-sm text-slate-600">Select a staff member to assign to this shift.</p>
            <select
              className="mt-4 w-full rounded-lg border border-slate-300 p-3 text-sm"
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
            >
              <option value="">Select staff member</option>
              {availableStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.firstName} {staff.lastName}
                </option>
              ))}
            </select>
            {availableStaff.length === 0 && (
              <p className="mt-2 text-sm text-amber-600">
                All active staff members are already assigned.
              </p>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedStaff("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={assignStaff}
                disabled={actionBusy || !selectedStaff}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
