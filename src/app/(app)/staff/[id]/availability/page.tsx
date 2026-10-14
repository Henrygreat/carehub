import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { StaffAvailability } from "@/components/staff-availability";

export const dynamic = "force-dynamic";

export default async function StaffAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const context = await resolveTenantContext(session);
  const membership = context.membership;

  if (!hasPermission(membership.role, "availability:read")) {
    redirect("/dashboard");
  }

  // Fetch staff profile
  const staffProfile = await db.staffProfile.findUnique({
    where: {
      id,
      organisationId: context.organisation.id,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      membershipUserId: true,
    },
  });

  if (!staffProfile) {
    redirect("/staff");
  }

  // Check if user can view this staff member's availability
  const isOwnProfile = staffProfile.membershipUserId === context.userId;
  if (membership.role === "CARE_WORKER" && !isOwnProfile) {
    redirect("/staff");
  }

  // Check if user can manage this availability
  const canManage = isOwnProfile
    ? hasPermission(membership.role, "availability:update")
    : hasPermission(membership.role, "availability:manage");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={`/staff/${id}`} className="text-sm font-medium text-teal-700 hover:text-teal-900">
        &larr; Back to profile
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-teal-700">{staffProfile.employeeNumber}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {staffProfile.firstName} {staffProfile.lastName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Availability schedule</p>
        </div>

        <StaffAvailability staffProfileId={id} canManage={canManage} />
      </section>
    </div>
  );
}
