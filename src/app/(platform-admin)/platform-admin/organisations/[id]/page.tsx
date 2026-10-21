import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, MapPin, Phone, Mail, Users, Globe } from "lucide-react";
import { db } from "@/lib/db";
import { resolvePlatformAdminContext } from "@/lib/platform-admin";
import { OrganisationActions } from "@/components/platform-admin/organisation-actions";
import { OrganisationEditForm } from "@/components/platform-admin/organisation-edit-form";

export const dynamic = "force-dynamic";

type PageParams = { params: Promise<{ id: string }> };

export default async function OrganisationDetailPage({ params }: PageParams) {
  await resolvePlatformAdminContext();
  const { id } = await params;

  const organisation = await db.organisation.findUnique({
    where: { id },
    include: {
      branches: {
        where: { status: "ACTIVE" },
        select: { id: true, name: true, code: true, isHeadOffice: true, city: true },
        orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }],
      },
      _count: {
        select: {
          memberships: { where: { active: true } },
          staffProfiles: { where: { employmentStatus: "ACTIVE" } },
          clients: { where: { status: "ACTIVE" } },
        },
      },
    },
  });

  if (!organisation) {
    notFound();
  }

  const recentAuditLogs = await db.platformAuditLog.findMany({
    where: { targetOrgId: id },
    select: {
      id: true,
      action: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <Link
            href="/platform-admin/organisations"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={16} /> Back to organisations
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="grid size-14 place-items-center rounded-xl text-xl font-bold text-white"
              style={{ backgroundColor: organisation.brandColour }}
            >
              {organisation.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {organisation.name}
              </h1>
              {organisation.tradingName && (
                <p className="text-slate-500">t/a {organisation.tradingName}</p>
              )}
              <StatusBadge status={organisation.status} />
            </div>
          </div>
        </div>
        <OrganisationActions
          organisationId={organisation.id}
          status={organisation.status}
          name={organisation.name}
        />
      </section>

      {/* Stats overview */}
      <section className="grid gap-4 sm:grid-cols-4">
        <StatCard
          icon={Users}
          label="Active users"
          value={organisation._count.memberships}
        />
        <StatCard
          icon={Users}
          label="Staff profiles"
          value={organisation._count.staffProfiles}
        />
        <StatCard
          icon={Users}
          label="Active clients"
          value={organisation._count.clients}
        />
        <StatCard
          icon={Building2}
          label="Branches"
          value={organisation.branches.length}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Organisation details */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Organisation Details</h2>
          <OrganisationEditForm organisation={organisation} />
        </section>

        {/* Branches */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Branches</h2>
          {organisation.branches.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No active branches.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {organisation.branches.map((branch) => (
                <li key={branch.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {branch.name}
                      {branch.isHeadOffice && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                          Head Office
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {branch.code} {branch.city && `· ${branch.city}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Contact & Address Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Contact Information</h2>
          <div className="mt-4 space-y-3">
            {organisation.contactEmail && (
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-slate-400" />
                <span className="text-sm text-slate-700">{organisation.contactEmail}</span>
              </div>
            )}
            {organisation.contactPhone && (
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-slate-400" />
                <span className="text-sm text-slate-700">{organisation.contactPhone}</span>
              </div>
            )}
            {organisation.timezone && (
              <div className="flex items-center gap-3">
                <Globe size={16} className="text-slate-400" />
                <span className="text-sm text-slate-700">{organisation.timezone}</span>
              </div>
            )}
            {!organisation.contactEmail && !organisation.contactPhone && (
              <p className="text-sm text-slate-500">No contact information provided.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Registered Address</h2>
          <div className="mt-4">
            {organisation.registeredAddressLine1 ? (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 text-slate-400" />
                <div className="text-sm text-slate-700">
                  <p>{organisation.registeredAddressLine1}</p>
                  {organisation.registeredAddressLine2 && (
                    <p>{organisation.registeredAddressLine2}</p>
                  )}
                  {organisation.registeredCity && <p>{organisation.registeredCity}</p>}
                  {organisation.registeredPostcode && (
                    <p>{organisation.registeredPostcode}</p>
                  )}
                  {organisation.registeredCountry && (
                    <p>{organisation.registeredCountry}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No address provided.</p>
            )}
          </div>
        </section>
      </div>

      {/* Recent Activity */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">Recent Activity</h2>
        {recentAuditLogs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No recent activity for this organisation.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {recentAuditLogs.map((log) => (
              <li key={log.id} className="flex items-start justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{log.action}</p>
                  <p className="text-xs text-slate-500">by {log.actor?.name ?? "System"}</p>
                </div>
                <time className="text-xs text-slate-400">
                  {new Date(log.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Metadata */}
      <section className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>
            Created:{" "}
            {new Date(organisation.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span>
            Last updated:{" "}
            {new Date(organisation.updatedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          {organisation.suspendedAt && (
            <span className="text-amber-600">
              Suspended:{" "}
              {new Date(organisation.suspendedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          <span className="font-mono">ID: {organisation.id}</span>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    SUSPENDED: "bg-amber-50 text-amber-700 border-amber-200",
    PENDING: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status] ?? styles.PENDING}`}
    >
      {status.toLowerCase()}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Icon size={18} />
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
