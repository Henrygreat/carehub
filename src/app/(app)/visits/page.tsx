import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { VisitCalendar } from "@/components/visit-calendar";

export const dynamic = "force-dynamic";

export default async function VisitsPage() {
  const context = await resolveTenantContext();
  assertPermission(context.membership, "visits:read");
  const canCreate = ["ORG_ADMIN", "MANAGER", "COORDINATOR"].includes(context.membership.role);
  return <VisitCalendar canCreate={canCreate} />;
}
