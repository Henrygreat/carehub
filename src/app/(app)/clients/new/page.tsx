import Link from "next/link";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { ClientForm } from "@/components/client-form";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const context = await resolveTenantContext();
  assertPermission(context.membership, "clients:create");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/clients" className="text-sm font-medium text-teal-700 hover:text-teal-900">
        ← Client directory
      </Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Register new client</h1>
        <ClientForm />
      </section>
    </div>
  );
}
