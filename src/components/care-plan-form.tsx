"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

type Client = {
  id: string;
  clientReference: string;
  firstName: string;
  lastName: string;
  status: string;
};

type TaskInput = {
  title: string;
  description: string;
  frequency: "EVERY_VISIT" | "DAILY" | "WEEKLY" | "MONTHLY" | "AS_NEEDED";
  isRequired: boolean;
  sortOrder: number;
};

type CarePlanData = {
  id?: string;
  clientId: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "UNDER_REVIEW" | "ARCHIVED";
  startDate: string;
  reviewDate: string | null;
  endDate: string | null;
  specialInstructions: string | null;
  isConfidential: boolean;
  tasks?: TaskInput[];
};

export function CarePlanForm({ planId }: { planId?: string }) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showTasks, setShowTasks] = useState(true);

  const [form, setForm] = useState<CarePlanData>({
    clientId: "",
    title: "",
    description: "",
    status: "DRAFT",
    startDate: new Date().toISOString().split("T")[0],
    reviewDate: null,
    endDate: null,
    specialInstructions: "",
    isConfidential: false,
    tasks: [],
  });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const promises: Promise<Response>[] = [fetch("/api/v1/clients?status=ACTIVE")];
      if (planId) {
        promises.push(fetch(`/api/v1/care-plans/${planId}`));
      }

      const responses = await Promise.all(promises);
      const bodies = await Promise.all(responses.map((r) => r.json()));

      const [clientsBody] = bodies;
      if (!responses[0].ok) throw new Error(clientsBody.error ?? "Unable to load clients.");
      setClients(clientsBody.data);

      if (planId && bodies[1]) {
        const planBody = bodies[1];
        if (!responses[1].ok) throw new Error(planBody.error ?? "Unable to load care plan.");
        const plan = planBody.data;
        setForm({
          clientId: plan.clientId,
          title: plan.title,
          description: plan.description ?? "",
          status: plan.status,
          startDate: plan.startDate.split("T")[0],
          reviewDate: plan.reviewDate?.split("T")[0] ?? null,
          endDate: plan.endDate?.split("T")[0] ?? null,
          specialInstructions: plan.specialInstructions ?? "",
          isConfidential: plan.isConfidential,
          tasks: plan.tasks?.map((t: TaskInput, i: number) => ({
            title: t.title,
            description: t.description ?? "",
            frequency: t.frequency,
            isRequired: t.isRequired,
            sortOrder: i,
          })) ?? [],
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [planId]);

  function addTask() {
    setForm({
      ...form,
      tasks: [
        ...(form.tasks ?? []),
        {
          title: "",
          description: "",
          frequency: "EVERY_VISIT",
          isRequired: true,
          sortOrder: (form.tasks?.length ?? 0),
        },
      ],
    });
  }

  function updateTask(index: number, updates: Partial<TaskInput>) {
    const tasks = [...(form.tasks ?? [])];
    tasks[index] = { ...tasks[index], ...updates };
    setForm({ ...form, tasks });
  }

  function removeTask(index: number) {
    const tasks = [...(form.tasks ?? [])];
    tasks.splice(index, 1);
    setForm({ ...form, tasks: tasks.map((t, i) => ({ ...t, sortOrder: i })) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        clientId: form.clientId,
        title: form.title,
        description: form.description || null,
        status: form.status,
        startDate: form.startDate,
        reviewDate: form.reviewDate || null,
        endDate: form.endDate || null,
        specialInstructions: form.specialInstructions || null,
        isConfidential: form.isConfidential,
        ...(planId ? {} : {
          tasks: form.tasks?.filter((t) => t.title.trim()).map((t, i) => ({
            title: t.title,
            description: t.description || null,
            frequency: t.frequency,
            isRequired: t.isRequired,
            sortOrder: i,
          })) ?? [],
        }),
      };

      const url = planId ? `/api/v1/care-plans/${planId}` : "/api/v1/care-plans";
      const method = planId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save care plan.");

      router.push(`/care-plans/${body.data.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save care plan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <Link href="/care-plans" className="text-sm font-medium text-teal-700 hover:text-teal-900">
        &larr; Back to care plans
      </Link>

      <h1 className="text-2xl font-semibold text-slate-900">
        {planId ? "Edit care plan" : "Create care plan"}
      </h1>

      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {/* Main Details */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Plan details</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Client *</label>
            <select
              required
              disabled={!!planId}
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100"
            >
              <option value="">Select a client...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.firstName} {client.lastName} ({client.clientReference})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="e.g., Personal Care Plan"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              rows={3}
              placeholder="Brief overview of the care plan..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Start date *</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Review date</label>
              <input
                type="date"
                value={form.reviewDate ?? ""}
                onChange={(e) => setForm({ ...form, reviewDate: e.target.value || null })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">End date</label>
              <input
                type="date"
                value={form.endDate ?? ""}
                onChange={(e) => setForm({ ...form, endDate: e.target.value || null })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Status</label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as CarePlanData["status"] })
              }
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Special instructions</label>
            <textarea
              value={form.specialInstructions ?? ""}
              onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              rows={3}
              placeholder="Any special instructions for care workers..."
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isConfidential}
              onChange={(e) => setForm({ ...form, isConfidential: e.target.checked })}
              className="size-4 rounded border-slate-300"
            />
            Confidential (only visible to coordinators and above)
          </label>
        </div>
      </section>

      {/* Tasks (only for new plans) */}
      {!planId && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => setShowTasks(!showTasks)}
            className="flex w-full items-center justify-between"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Care tasks ({form.tasks?.length ?? 0})
            </h2>
            {showTasks ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {showTasks && (
            <div className="mt-4 space-y-4">
              {form.tasks?.map((task, index) => (
                <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-medium text-slate-500">Task {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeTask(index)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-2 space-y-3">
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => updateTask(index, { title: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                      placeholder="Task title"
                    />
                    <textarea
                      value={task.description}
                      onChange={(e) => updateTask(index, { description: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                      rows={2}
                      placeholder="Description (optional)"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        value={task.frequency}
                        onChange={(e) =>
                          updateTask(index, { frequency: e.target.value as TaskInput["frequency"] })
                        }
                        className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                      >
                        <option value="EVERY_VISIT">Every visit</option>
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="AS_NEEDED">As needed</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={task.isRequired}
                          onChange={(e) => updateTask(index, { isRequired: e.target.checked })}
                          className="size-4 rounded border-slate-300"
                        />
                        Required
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addTask}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 hover:border-teal-400 hover:text-teal-700"
              >
                <Plus size={16} /> Add task
              </button>
            </div>
          )}
        </section>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Link
          href="/care-plans"
          className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center rounded-lg bg-teal-700 px-6 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : planId ? "Save changes" : "Create care plan"}
        </button>
      </div>
    </form>
  );
}
