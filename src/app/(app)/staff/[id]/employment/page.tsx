import Link from "next/link";
import { notFound } from "next/navigation";
import { assertPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function EmploymentPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await resolveTenantContext();
  assertPermission(context.membership, "staff:employment:read");
  const { id } = await params;
  const profile = await db.staffProfile.findFirst({
    where: { id, organisationId: context.organisation.id },
    select: { id: true, firstName: true, lastName: true, employeeNumber: true },
  });
  if (!profile) notFound();
  const records = await db.employmentRecord.findMany({
    where: { organisationId: context.organisation.id, staffProfileId: profile.id },
    orderBy: { startDate: "desc" },
  });
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={`/staff/${id}`} className="text-sm font-medium text-teal-700 hover:text-teal-900">← Staff profile</Link>
      <div>
        <p className="text-sm font-medium text-teal-700">{profile.employeeNumber}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Employment history</h1>
        <p className="mt-2 text-slate-500">{profile.firstName} {profile.lastName}</p>
      </div>
      {!records.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">No employment records are available.</div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <article key={record.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap justify-between gap-3">
                <div><h2 className="font-semibold text-slate-900">{record.title}</h2><p className="mt-1 text-sm text-slate-500">{record.employmentType.replace("_", " ").toLowerCase()}</p></div>
                <p className="text-sm text-slate-600">{record.weeklyHours.toString()} hours per week</p>
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {record.startDate.toLocaleDateString("en-GB")} – {record.endDate?.toLocaleDateString("en-GB") ?? "Present"}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
