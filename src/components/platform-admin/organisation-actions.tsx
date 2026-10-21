"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, PlayCircle } from "lucide-react";

type Props = {
  organisationId: string;
  status: string;
  name: string;
};

export function OrganisationActions({ organisationId, status, name }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [error, setError] = useState("");

  async function handleSuspend() {
    if (!suspendReason.trim() || suspendReason.trim().length < 5) {
      setError("Please provide a reason for suspension (minimum 5 characters).");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/v1/platform-admin/organisations/${organisationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend", reason: suspendReason.trim() }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to suspend organisation.");
      }

      setShowSuspendModal(false);
      setSuspendReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReactivate() {
    if (!confirm(`Are you sure you want to reactivate "${name}"?`)) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/v1/platform-admin/organisations/${organisationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to reactivate organisation.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        {status === "ACTIVE" ? (
          <button
            onClick={() => setShowSuspendModal(true)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
          >
            <PauseCircle size={16} /> Suspend
          </button>
        ) : status === "SUSPENDED" ? (
          <button
            onClick={handleReactivate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            <PlayCircle size={16} /> {busy ? "Reactivating..." : "Reactivate"}
          </button>
        ) : null}
      </div>

      {error && !showSuspendModal && (
        <p className="mt-2 text-sm text-rose-600">{error}</p>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Suspend Organisation</h2>
            <p className="mt-2 text-sm text-slate-600">
              Suspending <strong>{name}</strong> will prevent all users from accessing the platform.
              They will be signed out immediately.
            </p>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">Reason for suspension</span>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Provide a reason for this action..."
                className="mt-1.5 h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
              />
            </label>

            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSuspendModal(false);
                  setSuspendReason("");
                  setError("");
                }}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={busy}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                {busy ? "Suspending..." : "Confirm Suspension"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
