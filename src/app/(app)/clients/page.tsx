import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { ClientDirectory } from "@/components/client-directory";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const context = await resolveTenantContext();
  assertPermission(context.membership, "clients:read");
  const canCreate = ["ORG_ADMIN", "MANAGER", "COORDINATOR"].includes(context.membership.role);
  return <ClientDirectory canCreate={canCreate} />;
}
