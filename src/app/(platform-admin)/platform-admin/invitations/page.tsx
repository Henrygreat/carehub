import { Clock, Mail, Send } from "lucide-react";
import { db } from "@/lib/db";
import { resolvePlatformAdminContext } from "@/lib/platform-admin";
import { OrganisationInviteForm } from "@/components/platform-admin/organisation-invite-form";

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  await resolvePlatformAdminContext();

  const pendingInvitations = await db.organisationInvitation.findMany({
    where: {
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      organisationName: true,
      tradingName: true,
      contactEmail: true,
      primaryAdminName: true,
      primaryAdminEmail: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const expiredInvitations = await db.organisationInvitation.findMany({
    where: {
      acceptedAt: null,
      expiresAt: { lte: new Date() },
    },
    select: {
      id: true,
      organisationName: true,
      primaryAdminEmail: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const acceptedInvitations = await db.organisationInvitation.findMany({
    where: {
      acceptedAt: { not: null },
    },
    select: {
      id: true,
      organisationName: true,
      primaryAdminEmail: true,
      acceptedAt: true,
      createdAt: true,
      organisation: {
        select: { id: true, name: true },
      },
    },
    orderBy: { acceptedAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Organisation Invitations
        </h1>
        <p className="mt-1 text-slate-500">
          Invite new organisations to join the platform.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Invite Form */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <Send size={18} />
            </div>
            <h2 className="font-semibold text-slate-900">Invite New Organisation</h2>
          </div>
          <OrganisationInviteForm />
        </section>

        {/* Pending Invitations */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-teal-100 text-teal-700">
              <Mail size={18} />
            </div>
            <h2 className="font-semibold text-slate-900">
              Pending Invitations ({pendingInvitations.length})
            </h2>
          </div>
          {pendingInvitations.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No pending invitations.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {pendingInvitations.map((inv) => (
                <li key={inv.id} className="py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{inv.organisationName}</p>
                      <p className="text-sm text-slate-500">{inv.primaryAdminEmail}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Invited by {inv.invitedBy?.name ?? "Unknown"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <Clock size={12} />
                        Expires{" "}
                        {new Date(inv.expiresAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* History */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Accepted */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Recently Accepted</h2>
          {acceptedInvitations.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No accepted invitations yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {acceptedInvitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-800">{inv.organisationName}</p>
                    <p className="text-xs text-slate-500">{inv.primaryAdminEmail}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Accepted{" "}
                    {new Date(inv.acceptedAt!).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Expired */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Expired Invitations</h2>
          {expiredInvitations.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No expired invitations.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {expiredInvitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-800">{inv.organisationName}</p>
                    <p className="text-xs text-slate-500">{inv.primaryAdminEmail}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    Expired{" "}
                    {new Date(inv.expiresAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
