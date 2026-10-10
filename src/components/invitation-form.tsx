"use client";

import { useState } from "react";

export function InvitationForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/v1/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), role: form.get("role") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to send invitation.");
      setMessage("Invitation sent. The link will expire in seven days.");
      formElement.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="font-semibold text-slate-900">Invite a colleague</h2>
        <p className="mt-1 text-sm text-slate-500">They’ll receive a secure, one-time link to set up their account.</p>
      </div>
      <label className="block text-sm font-medium text-slate-700">Work email<input className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" type="email" name="email" required /></label>
      <label className="block text-sm font-medium text-slate-700">Organisation role
        <select className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" name="role" required>
          <option value="CARE_WORKER">Care worker</option>
          <option value="COORDINATOR">Coordinator</option>
          <option value="MANAGER">Manager</option>
          <option value="ORG_ADMIN">Organisation administrator</option>
        </select>
      </label>
      {message && <p role="status" className={`text-sm ${message.startsWith("Invitation sent") ? "text-emerald-700" : "text-rose-700"}`}>{message}</p>}
      <button disabled={busy} className="h-11 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">{busy ? "Sending…" : "Send invitation"}</button>
    </form>
  );
}
