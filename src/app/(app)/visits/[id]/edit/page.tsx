import Link from "next/link";
import { notFound } from "next/navigation";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { VisitForm } from "@/components/visit-form";

export const dynamic = "force-dynamic";

export default async function EditVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await resolveTenantContext();
  assertPermission(context.membership, "visits:update");

  const visit = await db.careVisit.findUnique({
    where: {
      id,
      organisationId: context.organisation.id,
    },
    select: {
      id: true,
      clientId: true,
      staffProfileId: true,
      scheduledDate: true,
      scheduledStart: true,
      scheduledEnd: true,
      visitType: true,
      notes: true,
      status: true,
    },
  });

  if (!visit) {
    notFound();
  }

  if (visit.status === "CANCELLED" || visit.status === "COMPLETED") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href={`/visits/${id}`} className="text-sm font-medium text-teal-700 hover:text-teal-900">
          ← Back to visit
        </Link>
        <div className="rounded-xl bg-amber-50 p-5 text-sm text-amber-800">
          This visit cannot be edited because it has been {visit.status.toLowerCase()}.
        </div>
      </div>
    );
  }

  // Format the time from Date objects to HH:MM strings
  const formatTime = (date: Date) => {
    return date.toISOString().substring(11, 16);
  };

  const initial = {
    clientId: visit.clientId,
    staffProfileId: visit.staffProfileId ?? "",
    scheduledDate: visit.scheduledDate.toISOString().split("T")[0],
    scheduledStart: formatTime(visit.scheduledStart),
    scheduledEnd: formatTime(visit.scheduledEnd),
    visitType: visit.visitType ?? "",
    notes: visit.notes ?? "",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={`/visits/${id}`} className="text-sm font-medium text-teal-700 hover:text-teal-900">
        ← Back to visit
      </Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Edit visit</h1>
        <VisitForm id={id} initial={initial} />
      </section>
    </div>
  );
}
