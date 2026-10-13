import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { ShiftCalendar } from "@/components/shift-calendar";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const context = await resolveTenantContext();
  assertPermission(context.membership, "shifts:read");
  const canCreate = ["ORG_ADMIN", "MANAGER"].includes(context.membership.role);
  return <ShiftCalendar canCreate={canCreate} />;
}
