import Link from "next/link";
import { notFound } from "next/navigation";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { ShiftForm } from "@/components/shift-form";

export const dynamic = "force-dynamic";

export default async function EditShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await resolveTenantContext();
  assertPermission(context.membership, "shifts:update");

  const shift = await db.shift.findUnique({
    where: {
      id,
      organisationId: context.organisation.id,
    },
    select: {
      id: true,
      shiftReference: true,
      locationName: true,
      locationAddress: true,
      scheduledDate: true,
      scheduledStart: true,
      scheduledEnd: true,
      isOvernight: true,
      notes: true,
      status: true,
      assignments: {
        select: {
          staffProfileId: true,
        },
      },
    },
  });

  if (!shift) {
    notFound();
  }

  if (shift.status === "CANCELLED" || shift.status === "COMPLETED") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href={`/shifts/${id}`} className="text-sm font-medium text-teal-700 hover:text-teal-900">
          ← Back to shift
        </Link>
        <div className="rounded-xl bg-amber-50 p-5 text-sm text-amber-800">
          This shift cannot be edited because it has been {shift.status.toLowerCase()}.
        </div>
      </div>
    );
  }

  // Format times
  const formatTime = (date: Date) => {
    return date.toISOString().substring(11, 16);
  };

  const initial = {
    shiftReference: shift.shiftReference,
    locationName: shift.locationName,
    locationAddress: shift.locationAddress ?? "",
    scheduledDate: shift.scheduledDate.toISOString().split("T")[0],
    scheduledStart: formatTime(shift.scheduledStart),
    scheduledEnd: formatTime(shift.scheduledEnd),
    isOvernight: shift.isOvernight,
    notes: shift.notes ?? "",
    staffProfileIds: shift.assignments.map((a) => a.staffProfileId),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={`/shifts/${id}`} className="text-sm font-medium text-teal-700 hover:text-teal-900">
        ← Back to shift
      </Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Edit shift</h1>
        <ShiftForm id={id} initial={initial} />
      </section>
    </div>
  );
}
