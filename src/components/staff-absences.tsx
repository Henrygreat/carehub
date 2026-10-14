"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendar, Check, Clock, Palmtree, Plus, X } from "lucide-react";

type Absence = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  startTimeStr?: string | null;
  endTimeStr?: string | null;
  isFullDay: boolean;
  reason?: string | null;
  notes?: string | null;
  status: string;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
};

type AbsencesResponse = {
  data: Absence[];
};

const absenceTypeLabels: Record<string, string> = {
  ANNUAL_LEAVE: "Annual leave",
  SICK_LEAVE: "Sick leave",
  UNPAID_LEAVE: "Unpaid leave",
  TRAINING: "Training",
  MATERNITY_LEAVE: "Maternity leave",
  PATERNITY_LEAVE: "Paternity leave",
  COMPASSIONATE: "Compassionate leave",
  OTHER: "Other",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  CANCELLED: "bg-slate-50 text-slate-500 border-slate-200",
};

interface StaffAbsencesProps {
  staffProfileId: string;
  canRequest: boolean;
  canApprove: boolean;
}

export function StaffAbsences({ staffProfileId, canRequest, canApprove }: StaffAbsencesProps) {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function fetchAbsences() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (showHistory) params.set("includeHistory", "true");

      const response = await fetch(`/api/v1/staff/${staffProfileId}/absences?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load absences.");

      setAbsences(body.data);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAbsences();
  }, [staffProfileId, showHistory]);

  async function cancelAbsence(absenceId: string) {
    if (!confirm("Cancel this absence request?")) return;

    try {
      const response = await fetch(`/api/v1/absences/${absenceId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Unable to cancel absence.");
      }
      await fetchAbsences();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    }
  }

  function formatDateRange(absence: Absence): string {
    const start = new Date(absence.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const end = new Date(absence.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    if (start === end) return start;
    return `${start} – ${end}`;
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading absences...</p>;
  }

  if (error) {
    return <div role="alert" className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palmtree size={20} className="text-teal-700" />
          <h3 className="text-lg font-semibold text-slate-900">Absences & Leave</h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(e) => setShowHistory(e.target.checked)}
              className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
            />
            Show history
          </label>
          {canRequest && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Plus size={16} />
              Request leave
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <AbsenceForm
          staffProfileId={staffProfileId}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchAbsences();
          }}
        />
      )}

      {absences.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
          <Palmtree size={40} className="mx-auto text-slate-300" />
          <p className="mt-4 text-sm text-slate-500">No absences recorded</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
          {absences.map((absence) => (
            <AbsenceCard
              key={absence.id}
              absence={absence}
              canApprove={canApprove}
              canCancel={canRequest && absence.status === "PENDING"}
              onCancel={() => cancelAbsence(absence.id)}
              onReviewed={fetchAbsences}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AbsenceCard({
  absence,
  canApprove,
  canCancel,
  onCancel,
  onReviewed,
}: {
  absence: Absence;
  canApprove: boolean;
  canCancel: boolean;
  onCancel: () => void;
  onReviewed: () => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");

  async function handleReview(status: "APPROVED" | "REJECTED") {
    setReviewing(true);
    setReviewError("");

    try {
      const response = await fetch(`/api/v1/absences/${absence.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to review absence.");

      onReviewed();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">
              {absenceTypeLabels[absence.type] ?? absence.type}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[absence.status]}`}>
              {absence.status.charAt(0) + absence.status.slice(1).toLowerCase()}
            </span>
          </div>

          <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
            <Calendar size={14} />
            {formatDateRange(absence)}
            {!absence.isFullDay && absence.startTimeStr && absence.endTimeStr && (
              <span className="ml-2 flex items-center gap-1">
                <Clock size={14} />
                {absence.startTimeStr} – {absence.endTimeStr}
              </span>
            )}
          </p>

          {absence.reason && (
            <p className="mt-2 text-sm text-slate-600">{absence.reason}</p>
          )}

          {absence.reviewedByName && (
            <p className="mt-2 text-xs text-slate-500">
              {absence.status === "APPROVED" ? "Approved" : "Rejected"} by {absence.reviewedByName}
              {absence.reviewedAt && ` on ${new Date(absence.reviewedAt).toLocaleDateString("en-GB")}`}
            </p>
          )}

          {reviewError && (
            <p className="mt-2 text-sm text-rose-700">{reviewError}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canApprove && absence.status === "PENDING" && (
            <>
              <button
                onClick={() => handleReview("APPROVED")}
                disabled={reviewing}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check size={14} />
                Approve
              </button>
              <button
                onClick={() => handleReview("REJECTED")}
                disabled={reviewing}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <X size={14} />
                Reject
              </button>
            </>
          )}
          {canCancel && (
            <button
              onClick={onCancel}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDateRange(absence: Absence): string {
  const start = new Date(absence.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const end = new Date(absence.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (start === end) return start;
  return `${start} – ${end}`;
}

function AbsenceForm({
  staffProfileId,
  onCancel,
  onSaved,
}: {
  staffProfileId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isFullDay, setIsFullDay] = useState(true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    try {
      const data: Record<string, unknown> = {
        type: formData.get("type"),
        startDate: formData.get("startDate"),
        endDate: formData.get("endDate") || formData.get("startDate"),
        isFullDay,
        reason: formData.get("reason") || null,
        notes: formData.get("notes") || null,
      };

      if (!isFullDay) {
        data.startTime = formData.get("startTime");
        data.endTime = formData.get("endTime");
      }

      const response = await fetch(`/api/v1/staff/${staffProfileId}/absences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to submit absence request.");

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
      <h4 className="font-semibold text-slate-900">Request Absence</h4>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Type
          <select
            name="type"
            required
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
          >
            {Object.entries(absenceTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 pt-6">
          <input
            type="checkbox"
            checked={isFullDay}
            onChange={(e) => setIsFullDay(e.target.checked)}
            className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
          />
          Full day(s)
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Start date
          <input
            type="date"
            name="startDate"
            required
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          End date
          <input
            type="date"
            name="endDate"
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
        </label>
      </div>

      {!isFullDay && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Start time
            <input
              type="time"
              name="startTime"
              required
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            End time
            <input
              type="time"
              name="endTime"
              required
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>
        </div>
      )}

      <label className="block text-sm font-medium text-slate-700">
        Reason (optional)
        <textarea
          name="reason"
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Brief reason for absence..."
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-rose-700">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? "Submitting..." : "Submit request"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
