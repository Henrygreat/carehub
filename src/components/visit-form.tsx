"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Client = {
  id: string;
  clientReference: string;
  firstName: string;
  lastName: string;
  status: string;
};

type StaffProfile = {
  id: string;
  firstName: string;
  lastName: string;
  employmentStatus: string;
};

type VisitFormValues = {
  clientId: string;
  staffProfileId: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  visitType: string;
  notes: string;
};

type ConflictWarning = {
  type: "visit" | "shift";
  time: string;
  clientOrLocation: string;
};

const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10";
const labelClass = "block text-sm font-medium text-slate-700";

export function VisitForm({
  id,
  initial,
}: {
  id?: string;
  initial?: Partial<VisitFormValues>;
}) {
  const [values, setValues] = useState<VisitFormValues>({
    clientId: initial?.clientId ?? "",
    staffProfileId: initial?.staffProfileId ?? "",
    scheduledDate: initial?.scheduledDate ?? "",
    scheduledStart: initial?.scheduledStart ?? "",
    scheduledEnd: initial?.scheduledEnd ?? "",
    visitType: initial?.visitType ?? "",
    notes: initial?.notes ?? "",
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const [clientsResponse, staffResponse] = await Promise.all([
          fetch("/api/v1/clients?status=ACTIVE"),
          fetch("/api/v1/staff"),
        ]);
        const [clientsBody, staffBody] = await Promise.all([
          clientsResponse.json(),
          staffResponse.json(),
        ]);
        if (clientsResponse.ok) {
          setClients(clientsBody.data);
        }
        if (staffResponse.ok) {
          setStaff(staffBody.data.filter((s: StaffProfile) => s.employmentStatus === "ACTIVE"));
        }
      } catch {
        // Silent fail, user can still enter manually
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  // Check for scheduling conflicts
  useEffect(() => {
    if (!values.staffProfileId || !values.scheduledDate || !values.scheduledStart || !values.scheduledEnd) {
      setConflicts([]);
      return;
    }

    const controller = new AbortController();
    async function checkConflicts() {
      try {
        const response = await fetch(
          `/api/v1/visits?staffProfileId=${values.staffProfileId}&date=${values.scheduledDate}`,
          { signal: controller.signal }
        );
        if (!response.ok) return;
        const body = await response.json();

        const newConflicts: ConflictWarning[] = [];
        for (const visit of body.data) {
          if (id && visit.id === id) continue; // Skip current visit when editing

          const visitStart = visit.scheduledStart;
          const visitEnd = visit.scheduledEnd;
          const newStart = values.scheduledStart;
          const newEnd = values.scheduledEnd;

          // Simple time overlap check (HH:MM format)
          if (newStart < visitEnd && newEnd > visitStart) {
            newConflicts.push({
              type: "visit",
              time: `${visitStart.substring(11, 16)} - ${visitEnd.substring(11, 16)}`,
              clientOrLocation: `${visit.client.firstName} ${visit.client.lastName}`,
            });
          }
        }
        setConflicts(newConflicts);
      } catch {
        // Ignore abort errors
      }
    }

    const timeout = setTimeout(checkConflicts, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [values.staffProfileId, values.scheduledDate, values.scheduledStart, values.scheduledEnd, id]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!values.clientId) {
      setMessage("Please select a client.");
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
      const payload = {
        clientId: values.clientId,
        staffProfileId: values.staffProfileId || null,
        scheduledDate: values.scheduledDate,
        scheduledStart: values.scheduledStart,
        scheduledEnd: values.scheduledEnd,
        visitType: values.visitType || null,
        notes: values.notes || null,
      };

      const response = await fetch(id ? `/api/v1/visits/${id}` : "/api/v1/visits", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save visit.");
      router.push(`/visits/${result.data.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save visit.");
    } finally {
      setBusy(false);
    }
  }

  function updateValue(field: keyof VisitFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  if (loadingData) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading...</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {message && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {message}
        </p>
      )}

      {conflicts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-800">Scheduling conflict detected</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-700">
            {conflicts.map((conflict, index) => (
              <li key={index}>
                {conflict.type === "visit" ? "Visit" : "Shift"} at {conflict.time} for{" "}
                {conflict.clientOrLocation}
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className="space-y-5">
        <legend className="text-sm font-semibold text-slate-900">Visit details</legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Client <span className="text-rose-500">*</span>
            <select
              className={fieldClass}
              value={values.clientId}
              onChange={(e) => updateValue("clientId", e.target.value)}
              required
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.firstName} {client.lastName} ({client.clientReference})
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Assigned carer
            <select
              className={fieldClass}
              value={values.staffProfileId}
              onChange={(e) => updateValue("staffProfileId", e.target.value)}
            >
              <option value="">Unassigned</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
          </label>
        </div>
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

        <label className={labelClass}>
          Visit type
          <input
            type="text"
            className={fieldClass}
            placeholder="e.g., Personal care, Medication, Companionship"
            value={values.visitType}
            onChange={(e) => updateValue("visitType", e.target.value)}
          />
        </label>
      </fieldset>

      <fieldset className="space-y-5 border-t border-slate-200 pt-5">
        <legend className="text-sm font-semibold text-slate-900">Notes</legend>

        <label className={labelClass}>
          Visit notes
          <textarea
            className="mt-1.5 min-h-[100px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10"
            placeholder="Any special instructions or notes for this visit..."
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
          {busy ? "Saving..." : id ? "Update visit" : "Schedule visit"}
        </button>
        <a
          href={id ? `/visits/${id}` : "/visits"}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
