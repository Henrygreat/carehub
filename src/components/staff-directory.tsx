"use client";

import Link from "next/link";
import { Search, UserRoundPlus } from "lucide-react";
import { useEffect, useState } from "react";

type Staff = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  employmentStatus: string;
  email?: string;
};
type StaffResponse = { data: Staff[]; pagination: { page: number; totalPages: number; total: number } };

const statusLabel: Record<string, string> = { ACTIVE: "Active", ON_LEAVE: "On leave", INACTIVE: "Inactive" };

export function StaffDirectory({ canCreate }: { canCreate: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<StaffResponse>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const query = new URLSearchParams({ page: String(page) });
    if (search.trim()) query.set("q", search.trim());
    if (status) query.set("status", status);
    fetch(`/api/v1/staff?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load staff.");
        return body as StaffResponse;
      })
      .then((body) => {
        if (active) {
          setResult(body);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active && reason instanceof Error && reason.name !== "AbortError") {
          setError(reason.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, search, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-teal-700">People</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Staff directory</h1>
          <p className="mt-2 text-sm text-slate-500">The people behind the care you deliver.</p>
        </div>
        {canCreate && (
          <Link href="/staff/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
            <UserRoundPlus size={17} aria-hidden="true" /> Add team member
          </Link>
        )}
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search staff</span>
            <Search className="absolute left-3 top-3 size-4 text-slate-400" aria-hidden="true" />
            <input
              className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10"
              placeholder="Search name or employee number"
              value={search}
              onChange={(event) => { setLoading(true); setPage(1); setSearch(event.target.value); }}
            />
          </label>
          <label>
            <span className="sr-only">Filter by employment status</span>
            <select className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-48" value={status} onChange={(event) => { setLoading(true); setPage(1); setStatus(event.target.value); }}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </div>
        {error ? (
          <div role="alert" className="p-8 text-center text-sm text-rose-700">{error}</div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading your staff directory…</div>
        ) : !result?.data.length ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500"><Search size={20} /></div>
            <h2 className="mt-4 font-semibold text-slate-900">No staff found</h2>
            <p className="mt-1 text-sm text-slate-500">{search || status ? "Try changing your search or filters." : "Add your first team member to get started."}</p>
            {canCreate && !search && !status && <Link href="/staff/new" className="mt-4 inline-flex text-sm font-semibold text-teal-700">Add a team member</Link>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-3 font-semibold">Team member</th><th className="px-5 py-3 font-semibold">Employee no.</th><th className="px-5 py-3 font-semibold">Job title</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4"><Link href={`/staff/${staff.id}`} className="font-medium text-slate-900 hover:text-teal-800">{staff.firstName} {staff.lastName}</Link>{staff.email && <p className="mt-0.5 text-xs text-slate-500">{staff.email}</p>}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{staff.employeeNumber}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{staff.jobTitle}</td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${staff.employmentStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : staff.employmentStatus === "ON_LEAVE" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{statusLabel[staff.employmentStatus] ?? staff.employmentStatus}</span></td>
                      <td className="px-5 py-4 text-right"><Link href={`/staff/${staff.id}`} className="text-sm font-semibold text-teal-700 hover:text-teal-900">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm">
              <p className="text-slate-500">{result.pagination.total} team {result.pagination.total === 1 ? "member" : "members"}</p>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => { setLoading(true); setPage((current) => current - 1); }} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40">Previous</button>
                <span className="px-1 text-slate-500">{page} / {Math.max(1, result.pagination.totalPages)}</span>
                <button disabled={page >= result.pagination.totalPages} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40">Next</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
