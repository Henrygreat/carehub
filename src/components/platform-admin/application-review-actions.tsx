"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Loader2, XCircle } from "lucide-react";

type Props = {
  applicationId: string;
  currentStatus: string;
};

export function ApplicationReviewActions({ applicationId, currentStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  async function handleAction(status: "UNDER_REVIEW" | "APPROVED" | "REJECTED") {
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/v1/platform-admin/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNotes: reviewNotes.trim() || null,
          rejectionReason: status === "REJECTED" ? rejectionReason.trim() : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to update application.");
      }

      router.refresh();
      setAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setBusy(false);
    }
  }

  if (action === "approve") {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="flex items-center gap-2 font-semibold text-emerald-900">
          <CheckCircle2 size={18} />
          Approve Application
        </h2>
        <p className="mt-2 text-sm text-emerald-700">
          This will create the organisation and send an invitation email to the primary contact.
        </p>
        <div className="mt-4">
          <label className="block text-sm font-medium text-emerald-800">
            Review notes (optional)
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-emerald-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Add any internal notes about this approval..."
            />
          </label>
        </div>
        {error && (
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => handleAction("APPROVED")}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Confirm Approval
          </button>
          <button
            onClick={() => setAction(null)}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  if (action === "reject") {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <h2 className="flex items-center gap-2 font-semibold text-rose-900">
          <XCircle size={18} />
          Reject Application
        </h2>
        <p className="mt-2 text-sm text-rose-700">
          This application will be marked as rejected. The applicant will not receive access.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-rose-800">
            Rejection reason (required)
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              required
              className="mt-1.5 w-full rounded-lg border border-rose-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              placeholder="Explain why this application is being rejected..."
            />
          </label>
          <label className="block text-sm font-medium text-rose-800">
            Internal notes (optional)
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-rose-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              placeholder="Add any internal notes..."
            />
          </label>
        </div>
        {error && (
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => handleAction("REJECTED")}
            disabled={busy || !rejectionReason.trim()}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
            Confirm Rejection
          </button>
          <button
            onClick={() => setAction(null)}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-slate-900">Review Actions</h2>
      <div className="mt-4 space-y-2">
        {currentStatus === "SUBMITTED" && (
          <button
            onClick={() => handleAction("UNDER_REVIEW")}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
            Mark Under Review
          </button>
        )}
        <button
          onClick={() => setAction("approve")}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <CheckCircle2 size={16} />
          Approve Application
        </button>
        <button
          onClick={() => setAction("reject")}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
        >
          <XCircle size={16} />
          Reject Application
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-rose-600">{error}</p>
      )}
    </section>
  );
}
