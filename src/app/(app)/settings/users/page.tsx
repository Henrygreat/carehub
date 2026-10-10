import { InvitationForm } from "@/components/invitation-form";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  const context = await resolveTenantContext();
  assertPermission(context.membership, "users:invite");
  return (
    <div className="space-y-6">
      <div><p className="text-sm font-medium text-teal-700">Access</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Users & access</h1><p className="mt-2 text-sm text-slate-500">Invite trusted people and give them the right level of access.</p></div>
      <InvitationForm />
    </div>
  );
}
