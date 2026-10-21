import Link from "next/link";
import { Building2, MapPin, Plus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const context = await resolveTenantContext();
  const canManageBranches = hasPermission(context.membership.role, "branches:create");

  const branches = await db.branch.findMany({
    where: { organisationId: context.organisation.id },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      city: true,
      postcode: true,
      phone: true,
      isHeadOffice: true,
      _count: {
        select: {
          staffAssignments: { where: { endDate: null } },
        },
      },
    },
    orderBy: [{ isHeadOffice: "desc" }, { status: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Branches</h1>
          <p className="mt-1 text-slate-500">
            Manage your organisation&apos;s branches and locations.
          </p>
        </div>
        {canManageBranches && (
          <Link
            href="/settings/branches/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
          >
            <Plus size={17} aria-hidden="true" /> Add branch
          </Link>
        )}
      </section>

      {branches.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Building2 size={40} className="mx-auto text-slate-300" />
          <h2 className="mt-4 font-semibold text-slate-700">No branches yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add your first branch to organise staff and operations.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/settings/branches/${branch.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`grid size-10 place-items-center rounded-xl ${
                    branch.status === "ACTIVE"
                      ? "bg-teal-100 text-teal-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Building2 size={18} />
                </div>
                <div className="flex items-center gap-2">
                  {branch.isHeadOffice && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      HQ
                    </span>
                  )}
                  <StatusBadge status={branch.status} />
                </div>
              </div>
              <h2 className="mt-4 font-semibold text-slate-900 group-hover:text-teal-700">
                {branch.name}
              </h2>
              <p className="text-sm text-slate-500">{branch.code}</p>
              {(branch.city || branch.postcode) && (
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                  <MapPin size={12} />
                  {[branch.city, branch.postcode].filter(Boolean).join(", ")}
                </div>
              )}
              <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
                <Users size={12} />
                {branch._count.staffAssignments} staff assigned
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
    INACTIVE: "bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.INACTIVE}`}
    >
      {status.toLowerCase()}
    </span>
  );
}
