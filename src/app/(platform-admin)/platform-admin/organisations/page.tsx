import Link from "next/link";
import { Building2, Eye, PauseCircle, Plus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { resolvePlatformAdminContext } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; search?: string }>;

export default async function OrganisationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await resolvePlatformAdminContext();
  const params = await searchParams;

  const organisations = await db.organisation.findMany({
    where: {
      ...(params.status
        ? { status: params.status as "ACTIVE" | "SUSPENDED" | "PENDING" }
        : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { tradingName: { contains: params.search, mode: "insensitive" } },
              { slug: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      tradingName: true,
      brandColour: true,
      status: true,
      contactEmail: true,
      createdAt: true,
      suspendedAt: true,
      _count: {
        select: {
          memberships: { where: { active: true } },
          branches: { where: { status: "ACTIVE" } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const statusCounts = await db.organisation.groupBy({
    by: ["status"],
    _count: true,
  });

  const counts = {
    all: organisations.length,
    ACTIVE: statusCounts.find((s) => s.status === "ACTIVE")?._count ?? 0,
    SUSPENDED: statusCounts.find((s) => s.status === "SUSPENDED")?._count ?? 0,
    PENDING: statusCounts.find((s) => s.status === "PENDING")?._count ?? 0,
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Organisations
          </h1>
          <p className="mt-1 text-slate-500">
            Manage all organisations on the platform.
          </p>
        </div>
        <Link
          href="/platform-admin/invitations"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-amber-400"
        >
          <Plus size={17} aria-hidden="true" /> Add organisation
        </Link>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/platform-admin/organisations"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            !params.status
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          All ({counts.all})
        </Link>
        <Link
          href="/platform-admin/organisations?status=ACTIVE"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            params.status === "ACTIVE"
              ? "bg-emerald-600 text-white"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          Active ({counts.ACTIVE})
        </Link>
        <Link
          href="/platform-admin/organisations?status=SUSPENDED"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            params.status === "SUSPENDED"
              ? "bg-amber-500 text-white"
              : "bg-amber-50 text-amber-700 hover:bg-amber-100"
          }`}
        >
          Suspended ({counts.SUSPENDED})
        </Link>
      </div>

      {/* Organisation list */}
      {organisations.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Building2 size={40} className="mx-auto text-slate-300" />
          <h2 className="mt-4 font-semibold text-slate-700">No organisations found</h2>
          <p className="mt-1 text-sm text-slate-500">
            {params.status || params.search
              ? "Try adjusting your filters."
              : "Get started by inviting your first organisation."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {organisations.map((org) => (
            <Link
              key={org.id}
              href={`/platform-admin/organisations/${org.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div
                  className="grid size-10 place-items-center rounded-xl text-white"
                  style={{ backgroundColor: org.brandColour }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <StatusBadge status={org.status} />
              </div>
              <h2 className="mt-4 font-semibold text-slate-900 group-hover:text-amber-700">
                {org.name}
              </h2>
              {org.tradingName && (
                <p className="mt-0.5 text-sm text-slate-500">t/a {org.tradingName}</p>
              )}
              <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users size={14} /> {org._count.memberships} users
                </span>
                <span className="flex items-center gap-1">
                  <Building2 size={14} /> {org._count.branches} branches
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 opacity-0 transition group-hover:opacity-100">
                <Eye size={14} /> View details
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    SUSPENDED: "bg-amber-50 text-amber-700",
    PENDING: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? styles.PENDING}`}
    >
      {status === "SUSPENDED" && <PauseCircle size={12} />}
      {status.toLowerCase()}
    </span>
  );
}
