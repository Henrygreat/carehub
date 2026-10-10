import Link from "next/link";
import { StaffForm } from "@/components/staff-form";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function NewStaffPage() {
  const context = await resolveTenantContext();
  assertPermission(context.membership, "staff:create");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/staff" className="text-sm font-medium text-teal-700 hover:text-teal-900">← Staff directory</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Add a team member</h1>
        <p className="mt-2 text-sm text-slate-500">Add staff details to {context.organisation.name}.</p>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <StaffForm />
      </section>
    </div>
  );
}
