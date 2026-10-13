"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Client = {
  id: string;
  clientReference: string;
  firstName: string;
  lastName: string;
};

type IncidentFormData = {
  clientId: string | null;
  visitId: string | null;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  occurredAt: string;
  location: string;
  description: string;
  immediateAction: string;
  followUpRequired: boolean;
};

const categories = [
  { value: "FALL", label: "Fall" },
  { value: "MEDICATION_ERROR", label: "Medication Error" },
  { value: "SAFEGUARDING", label: "Safeguarding" },
  { value: "BEHAVIOR", label: "Behavior" },
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "MISSED_CARE", label: "Missed Care" },
  { value: "HEALTH_CONCERN", label: "Health Concern" },
  { value: "PROPERTY_DAMAGE", label: "Property Damage" },
  { value: "OTHER", label: "Other" },
];

const severities = [
  { value: "LOW", label: "Low", description: "Minor issue, no immediate risk" },
  { value: "MEDIUM", label: "Medium", description: "Some concern, monitoring required" },
  { value: "HIGH", label: "High", description: "Serious issue, prompt action needed" },
  { value: "CRITICAL", label: "Critical", description: "Emergency, immediate escalation required" },
];

export function IncidentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const now = new Date();
  const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [form, setForm] = useState<IncidentFormData>({
    clientId: searchParams.get("clientId") || null,
    visitId: searchParams.get("visitId") || null,
    category: "OTHER",
    severity: "MEDIUM",
    occurredAt: localDateTime,
    location: "",
    description: "",
    immediateAction: "",
    followUpRequired: false,
  });

  async function loadClients() {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/clients?status=ACTIVE");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load clients.");
      setClients(body.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load clients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.description.trim().length < 10) {
      setError("Description must be at least 10 characters.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        clientId: form.clientId || null,
        visitId: form.visitId || null,
        category: form.category,
        severity: form.severity,
        occurredAt: new Date(form.occurredAt).toISOString(),
        location: form.location || null,
        description: form.description,
        immediateAction: form.immediateAction || null,
        followUpRequired: form.followUpRequired,
      };

      const response = await fetch("/api/v1/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to report incident.");

      router.push(`/incidents/${body.data.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to report incident.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <Link href="/incidents" className="text-sm font-medium text-teal-700 hover:text-teal-900">
        &larr; Back to incidents
      </Link>

      <h1 className="text-2xl font-semibold text-slate-900">Report Incident</h1>

      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {/* Incident Details */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Incident details</h2>

        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Category *</label>
              <select
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              >
                {categories.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">When did it occur? *</label>
              <input
                type="datetime-local"
                required
                value={form.occurredAt}
                onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Severity *</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {severities.map(({ value, label, description }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    form.severity === value
                      ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="severity"
                    value={value}
                    checked={form.severity === value}
                    onChange={(e) => setForm({ ...form, severity: e.target.value as IncidentFormData["severity"] })}
                    className="mt-0.5 size-4 border-slate-300 text-teal-600"
                  />
                  <div>
                    <span className="block text-sm font-medium text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500">{description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Client (optional)</label>
            <select
              value={form.clientId ?? ""}
              onChange={(e) => setForm({ ...form, clientId: e.target.value || null })}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">No client associated</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.firstName} {client.lastName} ({client.clientReference})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="Where did the incident occur?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Description * <span className="font-normal text-slate-500">(minimum 10 characters)</span>
            </label>
            <textarea
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              rows={4}
              placeholder="Describe what happened in detail..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Immediate action taken</label>
            <textarea
              value={form.immediateAction}
              onChange={(e) => setForm({ ...form, immediateAction: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              rows={3}
              placeholder="What steps were taken immediately after the incident?"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.followUpRequired}
              onChange={(e) => setForm({ ...form, followUpRequired: e.target.checked })}
              className="size-4 rounded border-slate-300"
            />
            Follow-up required
          </label>
        </div>
      </section>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Link
          href="/incidents"
          className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center rounded-lg bg-teal-700 px-6 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Report incident"}
        </button>
      </div>
    </form>
  );
}
