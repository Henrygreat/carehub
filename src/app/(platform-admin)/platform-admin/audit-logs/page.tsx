import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { resolvePlatformAdminContext } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ action?: string; limit?: string; offset?: string }>;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await resolvePlatformAdminContext();
  const params = await searchParams;

  const limit = Math.min(parseInt(params.limit ?? "50"), 100);
  const offset = parseInt(params.offset ?? "0");

  const auditLogs = await db.platformAuditLog.findMany({
    where: {
      ...(params.action ? { action: { contains: params.action } } : {}),
    },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      targetOrgId: true,
      metadata: true,
      ipAddress: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const total = await db.platformAuditLog.count({
    where: {
      ...(params.action ? { action: { contains: params.action } } : {}),
    },
  });

  // Get unique actions for filter
  const uniqueActions = await db.platformAuditLog.groupBy({
    by: ["action"],
    _count: true,
    orderBy: { action: "asc" },
  });

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Platform Audit Logs
        </h1>
        <p className="mt-1 text-slate-500">
          Track all platform-level administrative actions.
        </p>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/platform-admin/audit-logs"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            !params.action
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          All ({total})
        </a>
        {uniqueActions.slice(0, 5).map((actionGroup) => (
          <a
            key={actionGroup.action}
            href={`/platform-admin/audit-logs?action=${encodeURIComponent(actionGroup.action)}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              params.action === actionGroup.action
                ? "bg-amber-500 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            {actionGroup.action} ({actionGroup._count})
          </a>
        ))}
      </div>

      {/* Audit log table */}
      {auditLogs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <FileText size={40} className="mx-auto text-slate-300" />
          <h2 className="mt-4 font-semibold text-slate-700">No audit logs found</h2>
          <p className="mt-1 text-sm text-slate-500">
            {params.action
              ? "Try adjusting your filters."
              : "Platform actions will appear here."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  IP Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {log.actor?.name ?? "System"}
                      </p>
                      {log.actor?.email && (
                        <p className="text-xs text-slate-500">{log.actor.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-slate-700">{log.entityType}</p>
                      {log.entityId && (
                        <p className="truncate text-xs font-mono text-slate-400">
                          {log.entityId.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-xs font-mono text-slate-500">
                      {log.ipAddress ?? "-"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <time className="text-sm text-slate-500">
                      {new Date(log.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-500">
                Showing {offset + 1} to {Math.min(offset + auditLogs.length, total)} of{" "}
                {total} results
              </p>
              <div className="flex gap-2">
                {offset > 0 && (
                  <a
                    href={`/platform-admin/audit-logs?offset=${Math.max(0, offset - limit)}${params.action ? `&action=${params.action}` : ""}`}
                    className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
                  >
                    Previous
                  </a>
                )}
                {offset + limit < total && (
                  <a
                    href={`/platform-admin/audit-logs?offset=${offset + limit}${params.action ? `&action=${params.action}` : ""}`}
                    className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
