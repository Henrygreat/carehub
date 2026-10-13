import { resolveTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { IncidentDirectory } from "@/components/incident-directory";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const context = await resolveTenantContext();
  const canCreate = hasPermission(context.membership.role, "incidents:create");

  return <IncidentDirectory canCreate={canCreate} />;
}
