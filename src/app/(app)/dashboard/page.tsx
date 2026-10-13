import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  Calendar,
  CheckCircle,
  Clock,
  Heart,
  UserRoundPlus,
  UsersRound,
  XCircle,
} from "lucide-react";
import { resolveTenantContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await resolveTenantContext();
  const canViewStaff = hasPermission(context.membership.role, "staff:read");
  const canViewClients = hasPermission(context.membership.role, "clients:read");
  const canViewVisits = hasPermission(context.membership.role, "visits:read");
  const canViewShifts = hasPermission(context.membership.role, "shifts:read");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Build visit/shift scope based on role
  let staffProfileId: string | undefined;
  if (context.membership.role === "CARE_WORKER") {
    const staffProfile = await db.staffProfile.findFirst({
      where: {
        membershipUserId: context.userId,
        organisationId: context.organisation.id,
      },
      select: { id: true },
    });
    staffProfileId = staffProfile?.id;
  }

  const staffScope = {
    organisationId: context.organisation.id,
    ...(context.membership.role === "CARE_WORKER"
      ? { membershipUserId: context.userId }
      : {}),
  };

  const visitScope = {
    organisationId: context.organisation.id,
    ...(staffProfileId ? { staffProfileId } : {}),
  };

  const shiftScope = {
    organisationId: context.organisation.id,
    ...(staffProfileId
      ? { assignments: { some: { staffProfileId } } }
      : {}),
  };

  // Fetch all metrics in parallel
  const [
    totalStaff,
    activeStaff,
    pendingInvitations,
    activeClients,
    todaysVisits,
    completedVisitsToday,
    missedVisitsToday,
    unassignedVisitsToday,
    todaysShifts,
    unassignedShiftsToday,
  ] = await Promise.all([
    // Staff metrics
    canViewStaff ? db.staffProfile.count({ where: staffScope }) : Promise.resolve(0),
    canViewStaff
      ? db.staffProfile.count({
          where: { ...staffScope, employmentStatus: "ACTIVE" },
        })
      : Promise.resolve(0),
    context.membership.role === "ORG_ADMIN"
      ? db.invitation.count({
          where: {
            organisationId: context.organisation.id,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
        })
      : Promise.resolve(0),
    // Client metrics
    canViewClients
      ? db.client.count({
          where: { organisationId: context.organisation.id, status: "ACTIVE" },
        })
      : Promise.resolve(0),
    // Visit metrics
    canViewVisits
      ? db.careVisit.count({
          where: {
            ...visitScope,
            scheduledDate: { gte: today, lt: tomorrow },
          },
        })
      : Promise.resolve(0),
    canViewVisits
      ? db.careVisit.count({
          where: {
            ...visitScope,
            scheduledDate: { gte: today, lt: tomorrow },
            status: "COMPLETED",
          },
        })
      : Promise.resolve(0),
    canViewVisits
      ? db.careVisit.count({
          where: {
            ...visitScope,
            scheduledDate: { gte: today, lt: tomorrow },
            status: "MISSED",
          },
        })
      : Promise.resolve(0),
    canViewVisits && !staffProfileId
      ? db.careVisit.count({
          where: {
            organisationId: context.organisation.id,
            scheduledDate: { gte: today, lt: tomorrow },
            staffProfileId: null,
            status: { not: "CANCELLED" },
          },
        })
      : Promise.resolve(0),
    // Shift metrics
    canViewShifts
      ? db.shift.count({
          where: {
            ...shiftScope,
            scheduledDate: { gte: today, lt: tomorrow },
          },
        })
      : Promise.resolve(0),
    canViewShifts && !staffProfileId
      ? db.shift.count({
          where: {
            organisationId: context.organisation.id,
            scheduledDate: { gte: today, lt: tomorrow },
            status: { not: "CANCELLED" },
            assignments: { none: {} },
          },
        })
      : Promise.resolve(0),
  ]);

  // Build metrics array based on permissions
  type Metric = {
    label: string;
    value: number;
    icon: typeof UsersRound;
    note: string;
    color?: string;
    href?: string;
  };

  const metrics: Metric[] = [];

  // Staff metrics (existing)
  if (canViewStaff) {
    metrics.push({
      label: "Team members",
      value: totalStaff,
      icon: UsersRound,
      note: "Across your organisation",
      href: "/staff",
    });
    metrics.push({
      label: "Active staff",
      value: activeStaff,
      icon: BriefcaseBusiness,
      note: "Currently on your team",
      href: "/staff",
    });
  }

  if (context.membership.role === "ORG_ADMIN") {
    metrics.push({
      label: "Open invitations",
      value: pendingInvitations,
      icon: UserRoundPlus,
      note: "Awaiting a response",
      href: "/settings/users",
    });
  }

  // Client metrics (Phase 2)
  if (canViewClients) {
    metrics.push({
      label: "Active clients",
      value: activeClients,
      icon: Heart,
      note: "Receiving care from your organisation",
      href: "/clients",
    });
  }

  // Visit metrics (Phase 2)
  if (canViewVisits) {
    metrics.push({
      label: "Today's visits",
      value: todaysVisits,
      icon: Calendar,
      note: "Scheduled for today",
      href: "/visits",
    });
    metrics.push({
      label: "Completed today",
      value: completedVisitsToday,
      icon: CheckCircle,
      note: "Visits finished today",
      color: "emerald",
      href: "/visits",
    });
    if (missedVisitsToday > 0) {
      metrics.push({
        label: "Missed visits",
        value: missedVisitsToday,
        icon: XCircle,
        note: "Visits not completed",
        color: "rose",
        href: "/visits",
      });
    }
    if (unassignedVisitsToday > 0 && !staffProfileId) {
      metrics.push({
        label: "Unassigned visits",
        value: unassignedVisitsToday,
        icon: AlertTriangle,
        note: "Visits needing a carer",
        color: "amber",
        href: "/visits",
      });
    }
  }

  // Shift metrics (Phase 2)
  if (canViewShifts) {
    metrics.push({
      label: "Today's shifts",
      value: todaysShifts,
      icon: Clock,
      note: "Fixed location shifts today",
      href: "/shifts",
    });
    if (unassignedShiftsToday > 0 && !staffProfileId) {
      metrics.push({
        label: "Unassigned shifts",
        value: unassignedShiftsToday,
        icon: AlertTriangle,
        note: "Shifts needing staff",
        color: "amber",
        href: "/shifts",
      });
    }
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-teal-700">Your organisation</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Good to have you here
          </h1>
          <p className="mt-2 text-slate-500">
            A clear view of your people and the work that keeps care moving.
          </p>
        </div>
        {["ORG_ADMIN", "MANAGER"].includes(context.membership.role) && (
          <Link
            href="/staff/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
          >
            <UserRoundPlus size={17} aria-hidden="true" /> Add a team member
          </Link>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ label, value, note, icon: Icon, color, href }) => {
          const colorClasses = {
            teal: "bg-teal-50 text-teal-700",
            emerald: "bg-emerald-50 text-emerald-700",
            rose: "bg-rose-50 text-rose-700",
            amber: "bg-amber-50 text-amber-700",
          };
          const iconColorClass = colorClasses[color as keyof typeof colorClasses] ?? colorClasses.teal;

          const card = (
            <article
              className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${href ? "transition hover:border-teal-200 hover:shadow-md" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className={`grid size-10 place-items-center rounded-xl ${iconColorClass}`}>
                  <Icon size={19} aria-hidden="true" />
                </div>
                <span className="text-3xl font-semibold tracking-tight text-slate-900">{value}</span>
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

      {/* Quick Access Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canViewStaff && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Staff directory</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Keep staff details organised.
                </p>
              </div>
              <Link
                href="/staff"
                className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                View <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}

        {canViewClients && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Clients</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Manage client profiles and care needs.
                </p>
              </div>
              <Link
                href="/clients"
                className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                View <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}

        {canViewVisits && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Care visits</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Schedule and track client visits.
                </p>
              </div>
              <Link
                href="/visits"
                className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                View <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}

        {canViewShifts && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Shifts</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Fixed location and overnight shifts.
                </p>
              </div>
              <Link
                href="/shifts"
                className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                View <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
