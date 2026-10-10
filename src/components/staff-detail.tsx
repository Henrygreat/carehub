"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StaffForm } from "@/components/staff-form";

type StaffDetailData = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string | null;
  employmentStatus: string;
  employmentType?: string;
  jobTitle: string;
  startDate?: string;
  contractedWeeklyHours?: number | string;
  createdAt: string;
  updatedAt?: string;
};
type CurrentUser = { role: string };

export function StaffDetail({ id }: { id: string }) {
  const [staff, setStaff] = useState<StaffDetailData>();
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  async function load() {
    try {
      const [staffResponse, meResponse] = await Promise.all([
        fetch(`/api/v1/staff/${id}`),
        fetch("/api/v1/me"),
      ]);
      const [staffBody, meBody] = await Promise.all([staffResponse.json(), meResponse.json()]);
      if (!staffResponse.ok) throw new Error(staffBody.error ?? "Unable to load staff profile.");
      if (!meResponse.ok) throw new Error(meBody.error ?? "Unable to load your access details.");
      setStaff(staffBody.data);
      setRole((meBody.data as CurrentUser).role);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load staff profile.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    Promise.all([fetch(`/api/v1/staff/${id}`), fetch("/api/v1/me")])
      .then(async ([staffResponse, meResponse]) => {
        const [staffBody, meBody] = await Promise.all([staffResponse.json(), meResponse.json()]);
        if (!staffResponse.ok) throw new Error(staffBody.error ?? "Unable to load staff profile.");
        if (!meResponse.ok) throw new Error(meBody.error ?? "Unable to load your access details.");
        if (active) {
          setStaff(staffBody.data);
          setRole((meBody.data as CurrentUser).role);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load staff profile.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => { active = false; };
  }, [id]);

  async function deactivate() {
    if (!window.confirm("Deactivate this staff member? Their profile and employment history will be retained.")) return;
    const response = await fetch(`/api/v1/staff/${id}/deactivate`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) setError(body.error ?? "Unable to deactivate staff member.");
    else await load();
  }

  if (busy) return <p className="py-12 text-center text-sm text-slate-500">Loading profile…</p>;
  if (error || !staff) return <div role="alert" className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">{error || "Staff record not found."}</div>;

  const canUpdate = ["ORG_ADMIN", "MANAGER"].includes(role);
  const canDeactivate = role === "ORG_ADMIN";
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/staff" className="text-sm font-medium text-teal-700 hover:text-teal-900">← Staff directory</Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {editing ? (
          <>
            <h1 className="mb-6 text-2xl font-semibold text-slate-900">Edit staff profile</h1>
            <StaffForm id={id} initial={{ ...staff, phone: staff.phone ?? "", startDate: staff.startDate?.slice(0, 10), contractedWeeklyHours: String(staff.contractedWeeklyHours ?? "") }} />
          </>
        ) : (
          <>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium text-teal-700">{staff.employeeNumber}</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{staff.firstName} {staff.lastName}</h1>
                <p className="mt-2 text-slate-500">{staff.jobTitle}</p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${staff.employmentStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                {staff.employmentStatus === "ON_LEAVE" ? "On leave" : staff.employmentStatus === "INACTIVE" ? "Inactive" : "Active"}
              </span>
            </div>
            <dl className="mt-8 grid gap-5 border-t border-slate-200 pt-6 sm:grid-cols-2">
              {staff.email && <Detail label="Work email" value={staff.email} />}
              {staff.phone && <Detail label="Phone" value={staff.phone} />}
              {staff.employmentType && <Detail label="Employment type" value={staff.employmentType.replace("_", " ").toLowerCase()} />}
              {staff.startDate && <Detail label="Start date" value={new Date(staff.startDate).toLocaleDateString("en-GB")} />}
              {staff.contractedWeeklyHours !== undefined && <Detail label="Contracted hours" value={`${staff.contractedWeeklyHours} hours per week`} />}
              <Detail label="Profile created" value={new Date(staff.createdAt).toLocaleDateString("en-GB")} />
            </dl>
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
              {canUpdate && <button onClick={() => setEditing(true)} className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">Edit profile</button>}
              {role === "CARE_WORKER" && <button onClick={() => setEditingContact(true)} className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">Edit contact details</button>}
              {["ORG_ADMIN", "MANAGER"].includes(role) && <Link href={`/staff/${id}/employment`} className="h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Employment history</Link>}
              {canDeactivate && staff.employmentStatus !== "INACTIVE" && <button onClick={deactivate} className="h-10 rounded-lg border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50">Deactivate</button>}
            </div>
            {editingContact && role === "CARE_WORKER" && (
              <ContactForm
                id={id}
                email={staff.email ?? ""}
                phone={staff.phone ?? ""}
                onCancel={() => setEditingContact(false)}
                onSaved={load}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ContactForm({
  id,
  email,
  phone,
  onCancel,
  onSaved,
}: {
  id: string;
  email: string;
  phone: string;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/v1/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fields.get("email"),
          phone: fields.get("phone") || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to update contact details.");
      onCancel();
      await onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update contact details.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">Contact email<input className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" name="email" type="email" defaultValue={email} required /></label>
      <label className="text-sm font-medium text-slate-700">Phone<input className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" name="phone" type="tel" defaultValue={phone} /></label>
      {message && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">{message}</p>}
      <div className="flex gap-3 sm:col-span-2">
        <button disabled={busy} className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save contact details"}</button>
        <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancel</button>
      </div>
    </form>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm capitalize text-slate-900">{value}</dd></div>;
}
