"use client";

import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

type Client = {
  id: string;
  clientReference: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  phone?: string | null;
  postcode?: string | null;
  status: string;
};

type ClientResponse = {
  data: Client[];
  pagination: { page: number; totalPages: number; total: number };
};

const statusLabel: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-800",
  INACTIVE: "bg-amber-50 text-amber-800",
  ARCHIVED: "bg-slate-100 text-slate-600",
};

export function ClientDirectory({ canCreate }: { canCreate: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ClientResponse>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const query = new URLSearchParams({ page: String(page) });
    if (search.trim()) query.set("q", search.trim());
    if (status) query.set("status", status);

    fetch(`/api/v1/clients?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load clients.");
        return body as ClientResponse;
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
          <p className="text-sm font-medium text-teal-700">Care</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Clients
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Service users receiving care from your organisation.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/clients/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <UserPlus size={17} aria-hidden="true" /> Register client
          </Link>
        )}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search clients</span>
            <Search
              className="absolute left-3 top-3 size-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10"
              placeholder="Search name, reference or postcode"
              value={search}
              onChange={(event) => {
                setLoading(true);
                setPage(1);
                setSearch(event.target.value);
              }}
            />
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <select
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-48"
              value={status}
              onChange={(event) => {
                setLoading(true);
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="">Active clients</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
        </div>

        {error ? (
          <div role="alert" className="p-8 text-center text-sm text-rose-700">
            {error}
          </div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading clients…
          </div>
        ) : !result?.data.length ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <Search size={20} />
            </div>
            <h2 className="mt-4 font-semibold text-slate-900">No clients found</h2>
            <p className="mt-1 text-sm text-slate-500">
              {search || status
                ? "Try changing your search or filters."
                : "Register your first client to get started."}
            </p>
            {canCreate && !search && !status && (
              <Link
                href="/clients/new"
                className="mt-4 inline-flex text-sm font-semibold text-teal-700"
              >
                Register a client
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Client</th>
                    <th className="px-5 py-3 font-semibold">Reference</th>
                    <th className="px-5 py-3 font-semibold">Phone</th>
                    <th className="px-5 py-3 font-semibold">Postcode</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-medium text-slate-900 hover:text-teal-800"
                        >
                          {client.firstName} {client.lastName}
                        </Link>
                        {client.preferredName && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            Prefers: {client.preferredName}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {client.clientReference}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {client.phone || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {client.postcode || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            statusColors[client.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {statusLabel[client.status] ?? client.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/clients/${client.id}`}
                          className="text-sm font-semibold text-teal-700 hover:text-teal-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm">
              <p className="text-slate-500">
                {result.pagination.total} client
                {result.pagination.total === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => {
                    setLoading(true);
                    setPage((current) => current - 1);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-1 text-slate-500">
                  {page} / {Math.max(1, result.pagination.totalPages)}
                </span>
                <button
                  disabled={page >= result.pagination.totalPages}
                  onClick={() => {
                    setLoading(true);
                    setPage((current) => current + 1);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
