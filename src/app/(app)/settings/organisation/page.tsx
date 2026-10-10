import { OrganisationSettingsForm } from "@/components/organisation-settings";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function OrganisationSettingsPage() {
  const context = await resolveTenantContext();
  assertPermission(context.membership, "organisation:update");
  return (
    <div className="space-y-6">
      <div><p className="text-sm font-medium text-teal-700">Workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Organisation settings</h1><p className="mt-2 text-sm text-slate-500">Manage the identity of {context.organisation.name}.</p></div>
      <OrganisationSettingsForm />
    </div>
  );
}
