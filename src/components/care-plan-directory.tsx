"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  Plus,
  Search,
  User,
} from "lucide-react";

type CarePlan = {
  id: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "UNDER_REVIEW" | "ARCHIVED";
  startDate: string;
  reviewDate: string | null;
  endDate: string | null;
  isConfidential: boolean;
  createdAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    clientReference: string;
  };
  _count: {
    tasks: number;
  };
};

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  DRAFT: { label: "Draft", color: "bg-slate-100 text-slate-700 border-slate-200", icon: FileText },
  ACTIVE: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle },
  UNDER_REVIEW: { label: "Under Review", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  ARCHIVED: { label: "Archived", color: "bg-slate-100 text-slate-500 border-slate-200", icon: FileText },
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isReviewDue(reviewDate: string | null): boolean {
  if (!reviewDate) return false;
  const review = new Date(reviewDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return review <= today;
}

export function CarePlanDirectory({ canCreate }: { canCreate: boolean }) {
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showReviewDue, setShowReviewDue] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (showReviewDue) params.set("reviewDueBefore", new Date().toISOString());

      const response = await fetch(`/api/v1/care-plans?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load care plans.");
      setPlans(body.data);
      setTotal(body.pagination?.total ?? body.data.length);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load care plans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter, showReviewDue]);

  const filteredPlans = plans.filter((plan) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      plan.title.toLowerCase().includes(searchLower) ||
      plan.client.firstName.toLowerCase().includes(searchLower) ||
      plan.client.lastName.toLowerCase().includes(searchLower) ||
      plan.client.clientReference.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Care Plans</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage client care plans and tasks
          </p>
        </div>
        {canCreate && (
          <Link
            href="/care-plans/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus size={16} /> New care plan
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search plans or clients..."
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
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showReviewDue}
            onChange={(e) => setShowReviewDue(e.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          Review due
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold text-slate-900">{total}</div>
          <div className="text-sm text-slate-500">Total plans</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold text-emerald-600">
            {plans.filter((p) => p.status === "ACTIVE").length}
          </div>
          <div className="text-sm text-slate-500">Active</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold text-amber-600">
            {plans.filter((p) => isReviewDue(p.reviewDate) && p.status === "ACTIVE").length}
          </div>
          <div className="text-sm text-slate-500">Review due</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold text-slate-600">
            {plans.filter((p) => p.status === "DRAFT").length}
          </div>
          <div className="text-sm text-slate-500">Drafts</div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading care plans...</div>
      ) : filteredPlans.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <ClipboardList size={48} className="mx-auto text-slate-300" />
          <h3 className="mt-4 text-lg font-medium text-slate-900">No care plans found</h3>
          <p className="mt-1 text-sm text-slate-500">
            {search ? "Try adjusting your search." : "Create your first care plan to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPlans.map((plan) => {
            const status = statusConfig[plan.status] ?? statusConfig.DRAFT;
            const StatusIcon = status.icon;
            const reviewDue = isReviewDue(plan.reviewDate);

            return (
              <Link
                key={plan.id}
                href={`/care-plans/${plan.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-slate-900">
                        {plan.title}
                      </h2>
                      {plan.isConfidential && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                          Confidential
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                      <User size={14} />
                      {plan.client.firstName} {plan.client.lastName}
                      <span className="text-slate-400">•</span>
                      {plan.client.clientReference}
                    </p>
                    {plan.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{plan.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        Started {formatDate(plan.startDate)}
                      </span>
                      {plan.reviewDate && (
                        <span
                          className={`flex items-center gap-1 ${reviewDue ? "font-medium text-amber-600" : ""}`}
                        >
                          {reviewDue && <AlertCircle size={12} />}
                          Review {formatDate(plan.reviewDate)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <ClipboardList size={12} />
                        {plan._count.tasks} task{plan._count.tasks !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${status.color}`}
                  >
                    <StatusIcon size={12} />
                    {status.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
