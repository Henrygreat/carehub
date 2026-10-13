import Link from "next/link";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { ShiftForm } from "@/components/shift-form";

export const dynamic = "force-dynamic";

export default async function NewShiftPage() {
  const context = await resolveTenantContext();
  assertPermission(context.membership, "shifts:create");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/shifts" className="text-sm font-medium text-teal-700 hover:text-teal-900">
        ← Back to shifts
      </Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Create new shift</h1>
        <ShiftForm />
      </section>
    </div>
  );
}
