import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { StaffDirectory } from "@/components/staff-directory";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const context = await resolveTenantContext();
  assertPermission(context.membership, "staff:read");
  const canCreate = ["ORG_ADMIN", "MANAGER"].includes(context.membership.role);
  return <StaffDirectory canCreate={canCreate} />;
}
