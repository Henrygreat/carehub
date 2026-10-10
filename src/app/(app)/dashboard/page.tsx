import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, UserRoundPlus, UsersRound } from "lucide-react";
import { resolveTenantContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await resolveTenantContext();
  const canViewStaff = hasPermission(context.membership.role, "staff:read");
  const staffScope = {
    organisationId: context.organisation.id,
    ...(context.membership.role === "CARE_WORKER"
      ? { membershipUserId: context.userId }
      : {}),
  };
  const [totalStaff, activeStaff, pendingInvitations] = await Promise.all([
    canViewStaff ? db.staffProfile.count({ where: staffScope }) : Promise.resolve(0),
    canViewStaff ? db.staffProfile.count({
      where: { ...staffScope, employmentStatus: "ACTIVE" },
    }) : Promise.resolve(0),
    context.membership.role === "ORG_ADMIN" ? db.invitation.count({
      where: { organisationId: context.organisation.id, acceptedAt: null, expiresAt: { gt: new Date() } },
    }) : Promise.resolve(0),
  ]);
  const metrics = [
    { label: "Team members", value: totalStaff, icon: UsersRound, note: "Across your organisation" },
    { label: "Active staff", value: activeStaff, icon: BriefcaseBusiness, note: "Currently on your team" },
    { label: "Open invitations", value: pendingInvitations, icon: UserRoundPlus, note: "Awaiting a response" },
  ].filter(({ label }) => {
    if (label === "Open invitations") return context.membership.role === "ORG_ADMIN";
    return canViewStaff;
  });

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-teal-700">Your organisation</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Good to have you here</h1>
          <p className="mt-2 text-slate-500">A clear view of your people and the work that keeps care moving.</p>
        </div>
        {["ORG_ADMIN", "MANAGER"].includes(context.membership.role) && <Link
          href="/staff/new"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
        >
          <UserRoundPlus size={17} aria-hidden="true" /> Add a team member
        </Link>}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ label, value, note, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
                <Icon size={19} aria-hidden="true" />
              </div>
              <span className="text-3xl font-semibold tracking-tight text-slate-900">{value}</span>
            </div>
            <h2 className="mt-5 font-semibold text-slate-800">{label}</h2>
            <p className="mt-1 text-sm text-slate-500">{note}</p>
          </article>
        ))}
      </section>
      {canViewStaff && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Your people, in one place</h2>
            <p className="mt-1 text-sm text-slate-500">Keep staff details organised and access-controlled.</p>
          </div>
          <Link href="/staff" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900">
            Open directory <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>}
    </div>
  );
}
