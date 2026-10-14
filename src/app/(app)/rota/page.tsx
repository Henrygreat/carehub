import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { RotaCalendar } from "@/components/rota-calendar";

export const metadata = {
  title: "Rota | FalconCare Hub",
};

export default async function RotaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const context = await resolveTenantContext(session);
  const membership = context.membership;

  if (!hasPermission(membership.role, "rota:read")) {
    redirect("/dashboard");
  }

  const canManage = hasPermission(membership.role, "rota:manage");

  // Fetch staff list for filtering
  const staffList = await db.staffProfile.findMany({
    where: {
      organisationId: context.organisation.id,
      employmentStatus: "ACTIVE",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-700">Scheduling</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Rota</h1>
        <p className="mt-2 text-sm text-slate-500">
          View and manage the care schedule. {canManage && "Drag visits to reschedule."}
        </p>
      </div>

      <RotaCalendar canManage={canManage} staffList={staffList} />
    </div>
  );
}
