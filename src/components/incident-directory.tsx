"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  FileWarning,
  Plus,
  Search,
  User,
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
  followUpRequired: boolean;
  createdAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    clientReference: string;
  } | null;
  reportedBy: {
    user: { name: string };
  };
  reviewer: {
    user: { name: string };
  } | null;
};

const severityConfig: Record<string, { label: string; color: string; icon: typeof AlertCircle }> = {
  LOW: { label: "Low", color: "bg-slate-100 text-slate-700 border-slate-200", icon: AlertCircle },
  MEDIUM: { label: "Medium", color: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle },
  HIGH: { label: "High", color: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertTriangle },
  CRITICAL: { label: "Critical", color: "bg-rose-50 text-rose-700 border-rose-200", icon: FileWarning },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Open", color: "bg-rose-100 text-rose-800" },
  UNDER_REVIEW: { label: "Under Review", color: "bg-amber-100 text-amber-800" },
  RESOLVED: { label: "Resolved", color: "bg-emerald-100 text-emerald-800" },
  CLOSED: { label: "Closed", color: "bg-slate-100 text-slate-600" },
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
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IncidentDirectory({ canCreate }: { canCreate: boolean }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);

      const response = await fetch(`/api/v1/incidents?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load incidents.");
      setIncidents(body.data);
      setTotal(body.pagination?.total ?? body.data.length);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load incidents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter, severityFilter, categoryFilter]);

  const filteredIncidents = incidents.filter((incident) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      incident.incidentReference.toLowerCase().includes(searchLower) ||
      incident.description.toLowerCase().includes(searchLower) ||
      incident.client?.firstName.toLowerCase().includes(searchLower) ||
      incident.client?.lastName.toLowerCase().includes(searchLower) ||
      incident.reportedBy.user.name.toLowerCase().includes(searchLower)
    );
  });

  const openCount = incidents.filter((i) => i.status === "OPEN").length;
  const criticalCount = incidents.filter((i) => i.severity === "CRITICAL" && i.status !== "CLOSED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Incidents</h1>
          <p className="mt-1 text-sm text-slate-500">Track and manage incident reports</p>
        </div>
        {canCreate && (
          <Link
            href="/incidents/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus size={16} /> Report incident
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold text-slate-900">{total}</div>
          <div className="text-sm text-slate-500">Total incidents</div>
        </div>
        <div className={`rounded-xl border p-4 ${openCount > 0 ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
          <div className={`text-2xl font-semibold ${openCount > 0 ? "text-rose-600" : "text-slate-400"}`}>
            {openCount}
          </div>
          <div className="text-sm text-slate-500">Open</div>
        </div>
        <div className={`rounded-xl border p-4 ${criticalCount > 0 ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
          <div className={`text-2xl font-semibold ${criticalCount > 0 ? "text-rose-600" : "text-slate-400"}`}>
            {criticalCount}
          </div>
          <div className="text-sm text-slate-500">Critical</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold text-emerald-600">
            {incidents.filter((i) => i.status === "RESOLVED" || i.status === "CLOSED").length}
          </div>
          <div className="text-sm text-slate-500">Resolved</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search incidents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="all">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="all">All categories</option>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading incidents...</div>
      ) : filteredIncidents.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <FileWarning size={48} className="mx-auto text-slate-300" />
          <h3 className="mt-4 text-lg font-medium text-slate-900">No incidents found</h3>
          <p className="mt-1 text-sm text-slate-500">
            {search ? "Try adjusting your search or filters." : "No incidents have been reported."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIncidents.map((incident) => {
            const severity = severityConfig[incident.severity] ?? severityConfig.MEDIUM;
            const status = statusConfig[incident.status] ?? statusConfig.OPEN;
            const SeverityIcon = severity.icon;

            return (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {incident.incidentReference}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${severity.color}`}>
                        <SeverityIcon size={10} className="mr-1 inline" />
                        {severity.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      {incident.followUpRequired && incident.status !== "CLOSED" && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Follow-up required
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                      <span className="font-medium text-slate-700">
                        {categoryLabels[incident.category] ?? incident.category}
                      </span>
                      {incident.client && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {incident.client.firstName} {incident.client.lastName}
                          </span>
                        </>
                      )}
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDateTime(incident.occurredAt)}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{incident.description}</p>

                    <p className="mt-2 text-xs text-slate-500">
                      Reported by {incident.reportedBy.user.name}
                      {incident.reviewer && (
                        <span> • Reviewing: {incident.reviewer.user.name}</span>
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
