"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, PlayCircle } from "lucide-react";

type Props = {
  branchId: string;
  status: string;
  isHeadOffice: boolean;
  name: string;
};

export function BranchActions({ branchId, status, isHeadOffice, name }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleAction(action: "deactivate" | "reactivate") {
    const confirmMessage =
      action === "deactivate"
        ? `Are you sure you want to deactivate "${name}"? All staff assignments will be ended.`
        : `Are you sure you want to reactivate "${name}"?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/v1/branches/${branchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? `Failed to ${action} branch.`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        {status === "ACTIVE" && !isHeadOffice ? (
          <button
            onClick={() => handleAction("deactivate")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
          >
            <PauseCircle size={16} />
            {busy ? "Processing..." : "Deactivate"}
          </button>
        ) : status === "INACTIVE" ? (
          <button
            onClick={() => handleAction("reactivate")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            <PlayCircle size={16} />
            {busy ? "Processing..." : "Reactivate"}
          </button>
        ) : null}
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
