"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Archive,
  Calendar,
  CheckCircle,
  ChevronUp,
  ClipboardList,
  Clock,
  Edit2,
  Info,
  Plus,
  Trash2,
  User,
} from "lucide-react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  frequency: "EVERY_VISIT" | "DAILY" | "WEEKLY" | "MONTHLY" | "AS_NEEDED";
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
};

type CarePlan = {
  id: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "UNDER_REVIEW" | "ARCHIVED";
  startDate: string;
  reviewDate: string | null;
  endDate: string | null;
  specialInstructions: string | null;
  isConfidential: boolean;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    clientReference: string;
    preferredName: string | null;
  };
  tasks: Task[];
};

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  DRAFT: { label: "Draft", color: "text-slate-700", bgColor: "bg-slate-100 border-slate-200" },
  ACTIVE: { label: "Active", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" },
  UNDER_REVIEW: { label: "Under Review", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
  ARCHIVED: { label: "Archived", color: "text-slate-500", bgColor: "bg-slate-100 border-slate-200" },
};

const frequencyLabels: Record<string, string> = {
  EVERY_VISIT: "Every visit",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  AS_NEEDED: "As needed",
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function CarePlanDetail({ id }: { id: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    frequency: "EVERY_VISIT" as Task["frequency"],
    isRequired: true,
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [planRes, meRes] = await Promise.all([
        fetch(`/api/v1/care-plans/${id}`),
        fetch("/api/v1/me"),
      ]);
      const [planBody, meBody] = await Promise.all([planRes.json(), meRes.json()]);

      if (!planRes.ok) throw new Error(planBody.error ?? "Unable to load care plan.");
      if (!meRes.ok) throw new Error(meBody.error ?? "Unable to load user info.");

      setPlan(planBody.data);
      setRole(meBody.data.role);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load care plan.");
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
      const response = await fetch(`/api/v1/care-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to update status.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update status.");
    } finally {
      setActionBusy(false);
    }
  }

  async function addTask() {
    if (!newTask.title.trim()) return;
    setActionBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/care-plans/${id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carePlanId: id,
          title: newTask.title,
          description: newTask.description || null,
          frequency: newTask.frequency,
          isRequired: newTask.isRequired,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to add task.");
      setNewTask({ title: "", description: "", frequency: "EVERY_VISIT", isRequired: true });
      setShowAddTask(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add task.");
    } finally {
      setActionBusy(false);
    }
  }

  async function deleteTask(taskId: string) {
    setActionBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/care-plans/${id}/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Unable to delete task.");
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete task.");
    } finally {
      setActionBusy(false);
    }
  }

  async function deletePlan() {
    setActionBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/care-plans/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Unable to delete care plan.");
      }
      router.push("/care-plans");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete care plan.");
      setShowDeleteModal(false);
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading care plan...</p>;
  }

  if (error && !plan) {
    return (
      <div className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">{error}</div>
    );
  }

  if (!plan) {
    return <div className="text-center text-slate-500">Care plan not found.</div>;
  }

  const status = statusConfig[plan.status] ?? statusConfig.DRAFT;
  const canEdit = ["ORG_ADMIN", "MANAGER", "COORDINATOR"].includes(role);
  const canDelete = ["ORG_ADMIN", "MANAGER"].includes(role) && plan.status !== "ACTIVE";
  const isReviewDue = plan.reviewDate && new Date(plan.reviewDate) <= new Date();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/care-plans" className="text-sm font-medium text-teal-700 hover:text-teal-900">
        &larr; Back to care plans
      </Link>

      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{plan.title}</h1>
              {plan.isConfidential && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                  Confidential
                </span>
              )}
            </div>
            <Link
              href={`/clients/${plan.client.id}`}
              className="mt-1 flex items-center gap-1 text-sm text-teal-700 hover:text-teal-900"
            >
              <User size={14} />
              {plan.client.preferredName || plan.client.firstName} {plan.client.lastName}
              <span className="text-slate-400">({plan.client.clientReference})</span>
            </Link>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-sm font-medium ${status.bgColor} ${status.color}`}
          >
            {status.label}
          </span>
        </div>

        {plan.description && (
          <p className="mt-4 text-sm text-slate-700">{plan.description}</p>
        )}

        <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Start date
            </dt>
            <dd className="mt-1 flex items-center gap-1 text-sm text-slate-900">
              <Calendar size={14} className="text-slate-400" />
              {formatDate(plan.startDate)}
            </dd>
          </div>
          {plan.reviewDate && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Review date
              </dt>
              <dd
                className={`mt-1 flex items-center gap-1 text-sm ${
                  isReviewDue ? "font-medium text-amber-600" : "text-slate-900"
                }`}
              >
                {isReviewDue && <AlertCircle size={14} />}
                <Clock size={14} className={isReviewDue ? "text-amber-500" : "text-slate-400"} />
                {formatDate(plan.reviewDate)}
                {isReviewDue && <span className="ml-1 text-xs">(Due)</span>}
              </dd>
            </div>
          )}
          {plan.endDate && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                End date
              </dt>
              <dd className="mt-1 flex items-center gap-1 text-sm text-slate-900">
                <Calendar size={14} className="text-slate-400" />
                {formatDate(plan.endDate)}
              </dd>
            </div>
          )}
        </dl>

        {plan.specialInstructions && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
              <Info size={14} /> Special instructions
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-amber-800">
              {plan.specialInstructions}
            </p>
          </div>
        )}

        {/* Actions */}
        {canEdit && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
            {plan.status === "DRAFT" && (
              <button
                onClick={() => updateStatus("ACTIVE")}
                disabled={actionBusy}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                <CheckCircle size={16} /> Activate plan
              </button>
            )}
            {plan.status === "ACTIVE" && (
              <button
                onClick={() => updateStatus("UNDER_REVIEW")}
                disabled={actionBusy}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                <Clock size={16} /> Mark for review
              </button>
            )}
            {plan.status === "UNDER_REVIEW" && (
              <>
                <button
                  onClick={() => updateStatus("ACTIVE")}
                  disabled={actionBusy}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  <CheckCircle size={16} /> Approve &amp; reactivate
                </button>
                <button
                  onClick={() => updateStatus("ARCHIVED")}
                  disabled={actionBusy}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Archive size={16} /> Archive
                </button>
              </>
            )}
            {plan.status !== "ARCHIVED" && (
              <Link
                href={`/care-plans/${id}/edit`}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Edit2 size={16} /> Edit
              </Link>
            )}
            {canDelete && (
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={actionBusy}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
          </div>
        )}
      </section>

      {/* Tasks */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <ClipboardList size={20} />
            Care tasks ({plan.tasks.filter((t) => t.isActive).length})
          </h2>
          {canEdit && plan.status !== "ARCHIVED" && (
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900"
            >
              {showAddTask ? <ChevronUp size={16} /> : <Plus size={16} />}
              {showAddTask ? "Cancel" : "Add task"}
            </button>
          )}
        </div>

        {/* Add Task Form */}
        {showAddTask && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Task title *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                  placeholder="e.g., Assist with morning medication"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
                  rows={2}
                  placeholder="Optional additional details..."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Frequency</label>
                  <select
                    value={newTask.frequency}
                    onChange={(e) =>
                      setNewTask({ ...newTask, frequency: e.target.value as Task["frequency"] })
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                  >
                    <option value="EVERY_VISIT">Every visit</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="AS_NEEDED">As needed</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={newTask.isRequired}
                      onChange={(e) => setNewTask({ ...newTask, isRequired: e.target.checked })}
                      className="size-4 rounded border-slate-300"
                    />
                    Required task
                  </label>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={addTask}
                  disabled={actionBusy || !newTask.title.trim()}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  Add task
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task List */}
        {plan.tasks.filter((t) => t.isActive).length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No tasks defined for this care plan.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {plan.tasks
              .filter((t) => t.isActive)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((task) => (
                <div key={task.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900">{task.title}</h3>
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
                        {frequencyLabels[task.frequency] ?? task.frequency}
                      </p>
                    </div>
                    {canEdit && plan.status !== "ARCHIVED" && (
                      <button
                        onClick={() => deleteTask(task.id)}
                        disabled={actionBusy}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-50"
                        title="Delete task"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete care plan</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete this care plan? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={deletePlan}
                disabled={actionBusy}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
