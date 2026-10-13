import { resolveTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { CarePlanDirectory } from "@/components/care-plan-directory";

export const dynamic = "force-dynamic";

export default async function CarePlansPage() {
  const context = await resolveTenantContext();
  const canCreate = hasPermission(context.membership.role, "carePlans:create");

  return <CarePlanDirectory canCreate={canCreate} />;
}
