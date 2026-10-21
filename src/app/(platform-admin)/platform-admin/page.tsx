import Link from "next/link";
import { ArrowUpRight, Building2, Clock, Mail, PauseCircle, Users } from "lucide-react";
import { db } from "@/lib/db";
import { resolvePlatformAdminContext } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function PlatformAdminDashboardPage() {
  await resolvePlatformAdminContext();

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalOrganisations,
    activeOrganisations,
    suspendedOrganisations,
    pendingInvitations,
    totalUsers,
    recentAuditLogs,
    newOrganisationsLast30Days,
  ] = await Promise.all([
    db.organisation.count(),
    db.organisation.count({ where: { status: "ACTIVE" } }),
    db.organisation.count({ where: { status: "SUSPENDED" } }),
    db.organisationInvitation.count({
      where: { acceptedAt: null, expiresAt: { gt: now } },
    }),
    db.user.count({ where: { disabledAt: null } }),
    db.platformAuditLog.findMany({
      select: {
        id: true,
        action: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.organisation.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const metrics = [
    {
      label: "Total organisations",
      value: totalOrganisations,
      icon: Building2,
      note: "Registered on the platform",
      href: "/platform-admin/organisations",
    },
    {
      label: "Active organisations",
      value: activeOrganisations,
      icon: Building2,
      note: "Currently operational",
      color: "emerald",
      href: "/platform-admin/organisations?status=ACTIVE",
    },
    {
      label: "Suspended",
      value: suspendedOrganisations,
      icon: PauseCircle,
      note: "Temporarily suspended",
      color: suspendedOrganisations > 0 ? "amber" : "teal",
      href: "/platform-admin/organisations?status=SUSPENDED",
    },
    {
      label: "Pending invitations",
      value: pendingInvitations,
      icon: Mail,
      note: "Awaiting acceptance",
      href: "/platform-admin/invitations",
    },
    {
      label: "Total users",
      value: totalUsers,
      icon: Users,
      note: "Across all organisations",
    },
    {
      label: "New (30 days)",
      value: newOrganisationsLast30Days,
      icon: Clock,
      note: "Organisations added recently",
      color: "teal",
    },
  ];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-amber-600">Platform Administration</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Platform Overview
        </h1>
        <p className="mt-2 text-slate-500">
          Manage organisations and platform-wide settings.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ label, value, note, icon: Icon, color, href }) => {
          const colorClasses: Record<string, string> = {
            teal: "bg-teal-50 text-teal-700",
            emerald: "bg-emerald-50 text-emerald-700",
            amber: "bg-amber-50 text-amber-700",
          };
          const iconColorClass = colorClasses[color ?? "teal"] ?? colorClasses.teal;

          const card = (
            <article
              className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${href ? "transition hover:border-amber-200 hover:shadow-md" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className={`grid size-10 place-items-center rounded-xl ${iconColorClass}`}>
                  <Icon size={19} aria-hidden="true" />
                </div>
                <span className="text-3xl font-semibold tracking-tight text-slate-900">
                  {value}
                </span>
              </div>
              <h2 className="mt-5 font-semibold text-slate-800">{label}</h2>
              <p className="mt-1 text-sm text-slate-500">{note}</p>
            </article>
          );

          return href ? (
            <Link key={label} href={href}>
              {card}
            </Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Activity</h2>
            <Link
              href="/platform-admin/audit-logs"
              className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 hover:text-amber-700"
            >
              View all <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {recentAuditLogs.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No recent activity.</p>
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Quick Actions</h2>
          <div className="mt-4 space-y-3">
            <Link
              href="/platform-admin/organisations"
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 transition hover:border-amber-200 hover:bg-amber-50"
            >
              <div className="flex items-center gap-3">
                <Building2 size={20} className="text-slate-600" />
                <span className="font-medium text-slate-800">View organisations</span>
              </div>
              <ArrowUpRight size={16} className="text-slate-400" />
            </Link>
            <Link
              href="/platform-admin/invitations"
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 transition hover:border-amber-200 hover:bg-amber-50"
            >
              <div className="flex items-center gap-3">
                <Mail size={20} className="text-slate-600" />
                <span className="font-medium text-slate-800">Invite organisation</span>
              </div>
              <ArrowUpRight size={16} className="text-slate-400" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
