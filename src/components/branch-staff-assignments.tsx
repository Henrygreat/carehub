"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2, UserPlus } from "lucide-react";

type Assignment = {
  id: string;
  isPrimary: boolean;
  role: string | null;
  startDate: Date;
  staffProfile: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    jobTitle: string;
    employmentStatus: string;
  };
};

type Props = {
  branchId: string;
  assignments: Assignment[];
  canAssign: boolean;
};

export function BranchStaffAssignments({ branchId, assignments, canAssign }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleRemove(assignmentId: string, staffName: string) {
    if (!confirm(`Remove ${staffName} from this branch?`)) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/v1/branches/${branchId}/assignments?assignmentId=${assignmentId}`,
        { method: "DELETE" },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to remove assignment.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setBusy(false);
    }
  }

  if (assignments.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-8 text-center">
        <UserPlus size={24} className="mx-auto text-slate-300" />
        <p className="mt-2 text-sm text-slate-500">No staff assigned to this branch.</p>
        {canAssign && (
          <p className="mt-1 text-sm text-slate-400">
            Use the staff directory to assign staff to this branch.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Staff Member
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
              </th>
              {canAssign && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {assignments.map((assignment) => (
              <tr key={assignment.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium text-slate-800">
                        {assignment.staffProfile.firstName} {assignment.staffProfile.lastName}
                        {assignment.isPrimary && (
                          <Star
                            size={14}
                            className="ml-1 inline text-amber-500"
                            fill="currentColor"
                          />
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {assignment.staffProfile.employeeNumber} · {assignment.staffProfile.jobTitle}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-700">
                    {assignment.role ?? "-"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={assignment.staffProfile.employmentStatus} />
                </td>
                {canAssign && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() =>
                        handleRemove(
                          assignment.id,
                          `${assignment.staffProfile.firstName} ${assignment.staffProfile.lastName}`,
                        )
                      }
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canAssign && (
        <p className="mt-4 text-xs text-slate-400">
          To add staff to this branch, go to the staff member&apos;s profile and assign them to this branch.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    ON_LEAVE: "bg-amber-50 text-amber-700",
    INACTIVE: "bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.INACTIVE}`}
    >
      {status.toLowerCase().replace("_", " ")}
    </span>
  );
}
