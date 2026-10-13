"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

type StaffProfile = {
  id: string;
  firstName: string;
  lastName: string;
  employmentStatus: string;
};

type ShiftFormValues = {
  shiftReference: string;
  locationName: string;
  locationAddress: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  isOvernight: boolean;
  notes: string;
  staffProfileIds: string[];
};

const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10";
const labelClass = "block text-sm font-medium text-slate-700";

export function ShiftForm({
  id,
  initial,
}: {
  id?: string;
  initial?: Partial<ShiftFormValues>;
}) {
  const [values, setValues] = useState<ShiftFormValues>({
    shiftReference: initial?.shiftReference ?? "",
    locationName: initial?.locationName ?? "",
    locationAddress: initial?.locationAddress ?? "",
    scheduledDate: initial?.scheduledDate ?? "",
    scheduledStart: initial?.scheduledStart ?? "",
    scheduledEnd: initial?.scheduledEnd ?? "",
    isOvernight: initial?.isOvernight ?? false,
    notes: initial?.notes ?? "",
    staffProfileIds: initial?.staffProfileIds ?? [],
  });
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/api/v1/staff");
        const body = await response.json();
        if (response.ok) {
          setStaff(body.data.filter((s: StaffProfile) => s.employmentStatus === "ACTIVE"));
        }
      } catch {
        // Silent fail
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!values.locationName) {
      setMessage("Please enter a location name.");
      return;
    }
    if (!values.scheduledDate) {
      setMessage("Please select a date.");
      return;
    }
    if (!values.scheduledStart || !values.scheduledEnd) {
      setMessage("Please enter start and end times.");
      return;
    }

    setBusy(true);
    try {
      // Build datetime strings from date and time
      const startDateTime = `${values.scheduledDate}T${values.scheduledStart}:00`;
      let endDateTime = `${values.scheduledDate}T${values.scheduledEnd}:00`;

      // If overnight and end time is before start time, add a day to end date
      if (values.isOvernight && values.scheduledEnd < values.scheduledStart) {
        const nextDay = new Date(values.scheduledDate);
        nextDay.setDate(nextDay.getDate() + 1);
        endDateTime = `${nextDay.toISOString().split("T")[0]}T${values.scheduledEnd}:00`;
      }

      const payload = {
        shiftReference: values.shiftReference || undefined,
        locationName: values.locationName,
        locationAddress: values.locationAddress || null,
        scheduledDate: values.scheduledDate,
        scheduledStart: startDateTime,
        scheduledEnd: endDateTime,
        isOvernight: values.isOvernight,
        notes: values.notes || null,
        staffProfileIds: values.staffProfileIds.length > 0 ? values.staffProfileIds : undefined,
      };

      const response = await fetch(id ? `/api/v1/shifts/${id}` : "/api/v1/shifts", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save shift.");
      router.push(`/shifts/${result.data.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save shift.");
    } finally {
      setBusy(false);
    }
  }

  function updateValue<K extends keyof ShiftFormValues>(field: K, value: ShiftFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function addStaff(staffId: string) {
    if (staffId && !values.staffProfileIds.includes(staffId)) {
      updateValue("staffProfileIds", [...values.staffProfileIds, staffId]);
    }
  }

  function removeStaff(staffId: string) {
    updateValue(
      "staffProfileIds",
      values.staffProfileIds.filter((id) => id !== staffId)
    );
  }

  if (loadingData) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading...</p>;
  }

  const selectedStaff = staff.filter((s) => values.staffProfileIds.includes(s.id));
  const availableStaff = staff.filter((s) => !values.staffProfileIds.includes(s.id));

  return (
    <form onSubmit={submit} className="space-y-6">
      {message && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {message}
        </p>
      )}

      <fieldset className="space-y-5">
        <legend className="text-sm font-semibold text-slate-900">Location details</legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Shift reference
            <input
              type="text"
              className={fieldClass}
              placeholder="Auto-generated if empty"
              value={values.shiftReference}
              onChange={(e) => updateValue("shiftReference", e.target.value)}
            />
          </label>

          <label className={labelClass}>
            Location name <span className="text-rose-500">*</span>
            <input
              type="text"
              className={fieldClass}
              placeholder="e.g., Care Home A, Night Shift Station"
              value={values.locationName}
              onChange={(e) => updateValue("locationName", e.target.value)}
              required
            />
          </label>
        </div>

        <label className={labelClass}>
          Location address
          <input
            type="text"
            className={fieldClass}
            placeholder="Full address"
            value={values.locationAddress}
            onChange={(e) => updateValue("locationAddress", e.target.value)}
          />
        </label>
      </fieldset>

      <fieldset className="space-y-5 border-t border-slate-200 pt-5">
        <legend className="text-sm font-semibold text-slate-900">Schedule</legend>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className={labelClass}>
            Date <span className="text-rose-500">*</span>
            <input
              type="date"
              className={fieldClass}
              value={values.scheduledDate}
              onChange={(e) => updateValue("scheduledDate", e.target.value)}
              required
            />
          </label>

          <label className={labelClass}>
            Start time <span className="text-rose-500">*</span>
            <input
              type="time"
              className={fieldClass}
              value={values.scheduledStart}
              onChange={(e) => updateValue("scheduledStart", e.target.value)}
              required
            />
          </label>

          <label className={labelClass}>
            End time <span className="text-rose-500">*</span>
            <input
              type="time"
              className={fieldClass}
              value={values.scheduledEnd}
              onChange={(e) => updateValue("scheduledEnd", e.target.value)}
              required
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={values.isOvernight}
            onChange={(e) => updateValue("isOvernight", e.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          Overnight shift (ends the next day)
        </label>
      </fieldset>

      <fieldset className="space-y-5 border-t border-slate-200 pt-5">
        <legend className="text-sm font-semibold text-slate-900">Staff assignments</legend>

        {selectedStaff.length > 0 && (
          <div className="space-y-2">
            {selectedStaff.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <span className="text-sm font-medium text-slate-900">
                  {member.firstName} {member.lastName}
                </span>
                <button
                  type="button"
                  onClick={() => removeStaff(member.id)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {availableStaff.length > 0 && (
          <div className="flex gap-2">
            <select
              className={fieldClass}
              defaultValue=""
              onChange={(e) => {
                addStaff(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Add staff member...</option>
              {availableStaff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
          </div>
        )}

        {staff.length === 0 && (
          <p className="text-sm text-slate-500">No active staff available to assign.</p>
        )}
      </fieldset>

      <fieldset className="space-y-5 border-t border-slate-200 pt-5">
        <legend className="text-sm font-semibold text-slate-900">Notes</legend>

        <label className={labelClass}>
          Shift notes
          <textarea
            className="mt-1.5 min-h-[100px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10"
            placeholder="Any special instructions or notes for this shift..."
            value={values.notes}
            onChange={(e) => updateValue("notes", e.target.value)}
          />
        </label>
      </fieldset>

      <div className="flex items-center gap-3 border-t border-slate-200 pt-5">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? "Saving..." : id ? "Update shift" : "Create shift"}
        </button>
        <a
          href={id ? `/shifts/${id}` : "/shifts"}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
