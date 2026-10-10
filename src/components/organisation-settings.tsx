"use client";

import { useEffect, useState } from "react";

type OrganisationSettings = {
  name: string;
  brandName: string | null;
  brandColour: string;
};

export function OrganisationSettingsForm() {
  const [settings, setSettings] = useState<OrganisationSettings>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/v1/organisation")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load organisation.");
        setSettings(result.data);
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load organisation."))
      .finally(() => setLoading(false));
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/organisation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save settings.");
      setSettings(result.data);
      setMessage("Organisation settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading organisation settings…</p>;
  if (!settings) return <p role="alert" className="text-sm text-rose-700">{message}</p>;
  return (
    <form onSubmit={save} className="max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <Field label="Organisation name" value={settings.name} onChange={(name) => setSettings({ ...settings, name })} />
      <Field label="Display brand name (optional)" value={settings.brandName ?? ""} onChange={(brandName) => setSettings({ ...settings, brandName: brandName || null })} />
      <label className="block text-sm font-medium text-slate-700">
        Brand accent colour
        <div className="mt-1.5 flex h-11 items-center gap-3 rounded-lg border border-slate-300 px-3">
          <input type="color" value={settings.brandColour} onChange={(event) => setSettings({ ...settings, brandColour: event.target.value })} aria-label="Brand accent colour" className="size-7 cursor-pointer border-0 bg-transparent p-0" />
          <span className="text-sm text-slate-600">{settings.brandColour}</span>
        </div>
      </label>
      {message && <p role="status" className={`text-sm ${message.includes("saved") ? "text-emerald-700" : "text-rose-700"}`}>{message}</p>}
      <button disabled={busy} className="h-11 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">{busy ? "Saving…" : "Save changes"}</button>
    </form>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10" value={value} onChange={(event) => onChange(event.target.value)} required={label === "Organisation name"} /></label>;
}
