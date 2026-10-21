import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Mail, MapPin, Phone, Users } from "lucide-react";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { BranchActions } from "@/components/branch-actions";
import { BranchEditForm } from "@/components/branch-edit-form";
import { BranchStaffAssignments } from "@/components/branch-staff-assignments";

export const dynamic = "force-dynamic";

type PageParams = { params: Promise<{ id: string }> };

export default async function BranchDetailPage({ params }: PageParams) {
  const context = await resolveTenantContext();
  const { id } = await params;

  const canUpdate = hasPermission(context.membership.role, "branches:update");
  const canAssignStaff = hasPermission(context.membership.role, "branches:assign_staff");

  const branch = await db.branch.findFirst({
    where: {
      id,
      organisationId: context.organisation.id,
    },
    include: {
      staffAssignments: {
        where: { endDate: null },
        select: {
          id: true,
          isPrimary: true,
          role: true,
          startDate: true,
          staffProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              jobTitle: true,
              employmentStatus: true,
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { staffProfile: { lastName: "asc" } }],
      },
    },
  });

  if (!branch) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <Link
            href="/settings/branches"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={16} /> Back to branches
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <div
              className={`grid size-14 place-items-center rounded-xl ${
                branch.status === "ACTIVE"
                  ? "bg-teal-100 text-teal-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {branch.name}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-sm text-slate-500">{branch.code}</span>
                {branch.isHeadOffice && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Head Office
                  </span>
                )}
                <StatusBadge status={branch.status} />
              </div>
            </div>
          </div>
        </div>
        {canUpdate && (
          <BranchActions
            branchId={branch.id}
            status={branch.status}
            isHeadOffice={branch.isHeadOffice}
            name={branch.name}
          />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Branch Details */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Branch Details</h2>
          {canUpdate ? (
            <BranchEditForm branch={branch} />
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Name</p>
                <p className="text-slate-900">{branch.name}</p>
              </div>
              {branch.serviceArea && (
                <div>
                  <p className="text-sm font-medium text-slate-500">Service Area</p>
                  <p className="text-slate-900">{branch.serviceArea}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Contact & Location */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Contact & Location</h2>
          <div className="mt-4 space-y-3">
            {branch.addressLine1 && (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 text-slate-400" />
                <div className="text-sm text-slate-700">
                  <p>{branch.addressLine1}</p>
                  {branch.addressLine2 && <p>{branch.addressLine2}</p>}
                  {branch.city && <p>{branch.city}</p>}
                  {branch.postcode && <p>{branch.postcode}</p>}
                </div>
              </div>
            )}
            {branch.phone && (
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-slate-400" />
                <span className="text-sm text-slate-700">{branch.phone}</span>
              </div>
            )}
            {branch.email && (
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-slate-400" />
                <span className="text-sm text-slate-700">{branch.email}</span>
              </div>
            )}
            {!branch.addressLine1 && !branch.phone && !branch.email && (
              <p className="text-sm text-slate-500">No contact information provided.</p>
            )}
          </div>
        </section>
      </div>

      {/* Staff Assignments */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-slate-400" />
            <h2 className="font-semibold text-slate-900">
              Staff Assignments ({branch.staffAssignments.length})
            </h2>
          </div>
        </div>
        <BranchStaffAssignments
          branchId={branch.id}
          assignments={branch.staffAssignments}
          canAssign={canAssignStaff && branch.status === "ACTIVE"}
        />
      </section>

      {/* Metadata */}
      <section className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>
            Created:{" "}
            {new Date(branch.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span>
            Last updated:{" "}
            {new Date(branch.updatedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          {branch.cqcLocationId && (
            <span>CQC Location: {branch.cqcLocationId}</span>
          )}
          <span className="font-mono">ID: {branch.id}</span>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    INACTIVE: "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.INACTIVE}`}
    >
      {status.toLowerCase()}
    </span>
  );
}
