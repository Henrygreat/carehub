"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  User,
  XCircle,
} from "lucide-react";

type Incident = {
  id: string;
  incidentReference: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";
  occurredAt: string;
  location: string | null;
  description: string;
  immediateAction: string | null;
  followUpRequired: boolean;
  followUpNotes: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    clientReference: string;
    preferredName: string | null;
  } | null;
  visit: {
    id: string;
    scheduledDate: string;
  } | null;
  reportedBy: {
    user: { name: string };
  };
  reviewer: {
    user: { name: string };
  } | null;
};

const severityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  LOW: { label: "Low", color: "text-slate-700", bgColor: "bg-slate-100 border-slate-200" },
  MEDIUM: { label: "Medium", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
  HIGH: { label: "High", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200" },
  CRITICAL: { label: "Critical", color: "text-rose-700", bgColor: "bg-rose-50 border-rose-200" },
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  OPEN: { label: "Open", color: "text-rose-800", bgColor: "bg-rose-100" },
  UNDER_REVIEW: { label: "Under Review", color: "text-amber-800", bgColor: "bg-amber-100" },
  RESOLVED: { label: "Resolved", color: "text-emerald-800", bgColor: "bg-emerald-100" },
  CLOSED: { label: "Closed", color: "text-slate-600", bgColor: "bg-slate-100" },
};

const categoryLabels: Record<string, string> = {
  FALL: "Fall",
  MEDICATION_ERROR: "Medication Error",
  SAFEGUARDING: "Safeguarding",
  BEHAVIOR: "Behavior",
  EQUIPMENT: "Equipment",
  MISSED_CARE: "Missed Care",
  HEALTH_CONCERN: "Health Concern",
  PROPERTY_DAMAGE: "Property Damage",
  OTHER: "Other",
};

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IncidentDetail({ id }: { id: string }) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    status: "UNDER_REVIEW",
    followUpNotes: "",
    resolutionNotes: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [incidentRes, meRes] = await Promise.all([
        fetch(`/api/v1/incidents/${id}`),
        fetch("/api/v1/me"),
      ]);
      const [incidentBody, meBody] = await Promise.all([incidentRes.json(), meRes.json()]);

      if (!incidentRes.ok) throw new Error(incidentBody.error ?? "Unable to load incident.");
      if (!meRes.ok) throw new Error(meBody.error ?? "Unable to load user info.");

      setIncident(incidentBody.data);
      setRole(meBody.data.role);
      setReviewForm({
        status: incidentBody.data.status,
        followUpNotes: incidentBody.data.followUpNotes ?? "",
        resolutionNotes: incidentBody.data.resolutionNotes ?? "",
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load incident.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function updateStatus(newStatus: string) {
    setActionBusy(true);
    setError("");
    try {
      const payload: Record<string, string | boolean | null> = { status: newStatus };
      if (newStatus === "RESOLVED" || newStatus === "CLOSED") {
        payload.resolutionNotes = reviewForm.resolutionNotes || null;
      }
      if (reviewForm.followUpNotes) {
        payload.followUpNotes = reviewForm.followUpNotes;
      }

      const response = await fetch(`/api/v1/incidents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to update incident.");
      setShowReviewModal(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update incident.");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading incident...</p>;
  }

  if (error && !incident) {
    return (
      <div className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">{error}</div>
    );
  }

  if (!incident) {
    return <div className="text-center text-slate-500">Incident not found.</div>;
  }

  const severity = severityConfig[incident.severity] ?? severityConfig.MEDIUM;
  const status = statusConfig[incident.status] ?? statusConfig.OPEN;
  const canReview = ["ORG_ADMIN", "MANAGER", "COORDINATOR"].includes(role);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/incidents" className="text-sm font-medium text-teal-700 hover:text-teal-900">
        &larr; Back to incidents
      </Link>

      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold text-slate-900">
                {incident.incidentReference}
              </h1>
              <span className={`rounded-full border px-3 py-1 text-sm font-medium ${severity.bgColor} ${severity.color}`}>
                {severity.label}
              </span>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${status.bgColor} ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className="mt-2 text-lg font-medium text-slate-700">
              {categoryLabels[incident.category] ?? incident.category}
            </p>
          </div>
          {incident.followUpRequired && incident.status !== "CLOSED" && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
              <AlertTriangle size={14} />
              Follow-up required
            </span>
          )}
        </div>

        <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <Clock size={16} className="mt-0.5 text-slate-400" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Occurred at
              </dt>
              <dd className="mt-1 text-sm text-slate-900">{formatDateTime(incident.occurredAt)}</dd>
            </div>
          </div>
          {incident.location && (
            <div className="flex items-start gap-2">
              <MapPin size={16} className="mt-0.5 text-slate-400" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location
                </dt>
                <dd className="mt-1 text-sm text-slate-900">{incident.location}</dd>
              </div>
            </div>
          )}
          {incident.client && (
            <div className="flex items-start gap-2">
              <User size={16} className="mt-0.5 text-slate-400" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Client
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  <Link
                    href={`/clients/${incident.client.id}`}
                    className="text-teal-700 hover:text-teal-900"
                  >
                    {incident.client.preferredName || incident.client.firstName}{" "}
                    {incident.client.lastName}
                  </Link>
                  <span className="ml-1 text-slate-500">({incident.client.clientReference})</span>
                </dd>
              </div>
            </div>
          )}
          {incident.visit && (
            <div className="flex items-start gap-2">
              <Calendar size={16} className="mt-0.5 text-slate-400" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Related visit
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  <Link
                    href={`/visits/${incident.visit.id}`}
                    className="text-teal-700 hover:text-teal-900"
                  >
                    View visit
                  </Link>
                </dd>
              </div>
            </div>
          )}
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reported by
            </dt>
            <dd className="mt-1 text-sm text-slate-900">{incident.reportedBy.user.name}</dd>
          </div>
          {incident.reviewer && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reviewed by
              </dt>
              <dd className="mt-1 text-sm text-slate-900">{incident.reviewer.user.name}</dd>
            </div>
          )}
        </dl>

        {/* Actions */}
        {canReview && incident.status !== "CLOSED" && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
            {incident.status === "OPEN" && (
              <button
                onClick={() => updateStatus("UNDER_REVIEW")}
                disabled={actionBusy}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                <Clock size={16} /> Start review
              </button>
            )}
            {incident.status === "UNDER_REVIEW" && (
              <>
                <button
                  onClick={() => {
                    setReviewForm({ ...reviewForm, status: "RESOLVED" });
                    setShowReviewModal(true);
                  }}
                  disabled={actionBusy}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle size={16} /> Mark resolved
                </button>
                <button
                  onClick={() => {
                    setReviewForm({ ...reviewForm, status: "CLOSED" });
                    setShowReviewModal(true);
                  }}
                  disabled={actionBusy}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <XCircle size={16} /> Close
                </button>
              </>
            )}
            {incident.status === "RESOLVED" && (
              <button
                onClick={() => updateStatus("CLOSED")}
                disabled={actionBusy}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <XCircle size={16} /> Close incident
              </button>
            )}
          </div>
        )}
      </section>

      {/* Description */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Description</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{incident.description}</p>
      </section>

      {/* Immediate Action */}
      {incident.immediateAction && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-800">
            <AlertTriangle size={18} />
            Immediate action taken
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-amber-900">{incident.immediateAction}</p>
        </section>
      )}

      {/* Follow-up Notes */}
      {incident.followUpNotes && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Follow-up notes</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{incident.followUpNotes}</p>
        </section>
      )}

      {/* Resolution Notes */}
      {incident.resolutionNotes && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-800">
            <CheckCircle size={18} />
            Resolution
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-emerald-900">{incident.resolutionNotes}</p>
          {incident.resolvedAt && (
            <p className="mt-2 text-xs text-emerald-700">
              Resolved on {formatDateTime(incident.resolvedAt)}
            </p>
          )}
        </section>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {reviewForm.status === "RESOLVED" ? "Resolve incident" : "Close incident"}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Follow-up notes</label>
                <textarea
                  value={reviewForm.followUpNotes}
                  onChange={(e) => setReviewForm({ ...reviewForm, followUpNotes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                  rows={3}
                  placeholder="Any additional follow-up notes..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Resolution notes {reviewForm.status === "RESOLVED" && "*"}
                </label>
                <textarea
                  value={reviewForm.resolutionNotes}
                  onChange={(e) => setReviewForm({ ...reviewForm, resolutionNotes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                  rows={3}
                  placeholder="How was this incident resolved..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatus(reviewForm.status)}
                disabled={actionBusy}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {reviewForm.status === "RESOLVED" ? "Resolve" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
