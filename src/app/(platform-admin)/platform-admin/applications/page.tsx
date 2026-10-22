import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  XCircle,
} from "lucide-react";
import type { ApplicationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { resolvePlatformAdminContext } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; search?: string }>;

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await resolvePlatformAdminContext();
  const params = await searchParams;

  const where = {
    ...(params.status
      ? { status: params.status as "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" }
      : {}),
    ...(params.search
      ? {
          OR: [
            { companyName: { contains: params.search, mode: "insensitive" as const } },
            { primaryContactEmail: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const applications = await db.organisationApplication.findMany({
    where,
    select: {
      id: true,
      companyName: true,
      tradingName: true,
      primaryContactName: true,
      primaryContactEmail: true,
      careServiceTypes: true,
      estimatedStaffCount: true,
      status: true,
      submittedAt: true,
      reviewedAt: true,
      reviewedBy: {
        select: { name: true },
      },
    },
    orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
  });

  const statusCounts = await db.organisationApplication.groupBy({
    by: ["status"],
    _count: true,
  });

  const counts = {
    all: applications.length,
    SUBMITTED: statusCounts.find((s: { status: ApplicationStatus }) => s.status === "SUBMITTED")?._count ?? 0,
    UNDER_REVIEW: statusCounts.find((s: { status: ApplicationStatus }) => s.status === "UNDER_REVIEW")?._count ?? 0,
    APPROVED: statusCounts.find((s: { status: ApplicationStatus }) => s.status === "APPROVED")?._count ?? 0,
    REJECTED: statusCounts.find((s: { status: ApplicationStatus }) => s.status === "REJECTED")?._count ?? 0,
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Organisation Applications
        </h1>
        <p className="mt-1 text-slate-500">
          Review and approve applications from care providers.
        </p>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/platform-admin/applications"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            !params.status
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          All ({counts.all})
        </Link>
        <Link
          href="/platform-admin/applications?status=SUBMITTED"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            params.status === "SUBMITTED"
              ? "bg-amber-500 text-white"
              : "bg-amber-50 text-amber-700 hover:bg-amber-100"
          }`}
        >
          Pending ({counts.SUBMITTED})
        </Link>
        <Link
          href="/platform-admin/applications?status=UNDER_REVIEW"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            params.status === "UNDER_REVIEW"
              ? "bg-blue-600 text-white"
              : "bg-blue-50 text-blue-700 hover:bg-blue-100"
          }`}
        >
          Under Review ({counts.UNDER_REVIEW})
        </Link>
        <Link
          href="/platform-admin/applications?status=APPROVED"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            params.status === "APPROVED"
              ? "bg-emerald-600 text-white"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          Approved ({counts.APPROVED})
        </Link>
        <Link
          href="/platform-admin/applications?status=REJECTED"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            params.status === "REJECTED"
              ? "bg-rose-600 text-white"
              : "bg-rose-50 text-rose-700 hover:bg-rose-100"
          }`}
        >
          Rejected ({counts.REJECTED})
        </Link>
      </div>

      {/* Applications list */}
      {applications.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <FileText size={40} className="mx-auto text-slate-300" />
          <h2 className="mt-4 font-semibold text-slate-700">No applications found</h2>
          <p className="mt-1 text-sm text-slate-500">
            {params.status || params.search
              ? "Try adjusting your filters."
              : "Applications will appear here when care providers apply."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Organisation
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Services
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Submitted
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-lg bg-teal-100 text-teal-700">
                        <Building2 size={16} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{app.companyName}</p>
                        {app.tradingName && (
                          <p className="text-xs text-slate-500">t/a {app.tradingName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-700">{app.primaryContactName}</p>
                    <p className="text-xs text-slate-500">{app.primaryContactEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-700">
                      {app.careServiceTypes.slice(0, 2).join(", ")}
                      {app.careServiceTypes.length > 2 && (
                        <span className="text-slate-400">
                          {" "}+{app.careServiceTypes.length - 2}
                        </span>
                      )}
                    </p>
                    {app.estimatedStaffCount && (
                      <p className="text-xs text-slate-500">~{app.estimatedStaffCount} staff</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {app.submittedAt
                      ? new Date(app.submittedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/platform-admin/applications/${app.id}`}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50"
                    >
                      <Eye size={14} /> Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    SUBMITTED: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      icon: <Clock size={12} />,
    },
    UNDER_REVIEW: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      icon: <Eye size={12} />,
    },
    APPROVED: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      icon: <CheckCircle2 size={12} />,
    },
    REJECTED: {
      bg: "bg-rose-50",
      text: "text-rose-700",
      icon: <XCircle size={12} />,
    },
  };

  const style = config[status] ?? config.SUBMITTED;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.icon}
      {status.replace("_", " ").toLowerCase()}
    </span>
  );
}
