import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { NewBranchForm } from "@/components/new-branch-form";

export default async function NewBranchPage() {
  const context = await resolveTenantContext();

  if (!hasPermission(context.membership.role, "branches:create")) {
    redirect("/settings/branches");
  }

  return (
    <div className="space-y-6">
      <section>
        <Link
          href="/settings/branches"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={16} /> Back to branches
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
          Add New Branch
        </h1>
        <p className="mt-1 text-slate-500">
          Create a new branch location for your organisation.
        </p>
      </section>

      <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <NewBranchForm />
      </section>
    </div>
  );
}
