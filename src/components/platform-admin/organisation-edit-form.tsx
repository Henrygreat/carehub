"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Organisation } from "@prisma/client";

type Props = {
  organisation: Organisation;
};

export function OrganisationEditForm({ organisation }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: organisation.name,
    brandName: organisation.brandName ?? "",
    brandColour: organisation.brandColour,
    tradingName: organisation.tradingName ?? "",
    companyRegistrationNo: organisation.companyRegistrationNo ?? "",
    contactEmail: organisation.contactEmail ?? "",
    contactPhone: organisation.contactPhone ?? "",
    cqcProviderId: organisation.cqcProviderId ?? "",
    cqcProviderName: organisation.cqcProviderName ?? "",
    cqcRegisteredManager: organisation.cqcRegisteredManager ?? "",
    timezone: organisation.timezone,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(
        `/api/v1/platform-admin/organisations/${organisation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            brandName: formData.brandName.trim() || null,
            brandColour: formData.brandColour,
            tradingName: formData.tradingName.trim() || null,
            companyRegistrationNo: formData.companyRegistrationNo.trim() || null,
            contactEmail: formData.contactEmail.trim() || null,
            contactPhone: formData.contactPhone.trim() || null,
            cqcProviderId: formData.cqcProviderId.trim() || null,
            cqcProviderName: formData.cqcProviderName.trim() || null,
            cqcRegisteredManager: formData.cqcRegisteredManager.trim() || null,
            timezone: formData.timezone,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to update organisation.");
      }

      setMessage("Organisation updated successfully.");
      setIsError(false);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "An error occurred.");
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  function updateField(field: keyof typeof formData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Organisation name"
          value={formData.name}
          onChange={(v) => updateField("name", v)}
          required
        />
        <Field
          label="Trading name"
          value={formData.tradingName}
          onChange={(v) => updateField("tradingName", v)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Brand name"
          value={formData.brandName}
          onChange={(v) => updateField("brandName", v)}
        />
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Brand colour
            <div className="mt-1.5 flex h-10 items-center gap-3 rounded-lg border border-slate-300 px-3">
              <input
                type="color"
                value={formData.brandColour}
                onChange={(e) => updateField("brandColour", e.target.value)}
                className="size-6 cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-sm text-slate-600">{formData.brandColour}</span>
            </div>
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Contact email"
          type="email"
          value={formData.contactEmail}
          onChange={(v) => updateField("contactEmail", v)}
        />
        <Field
          label="Contact phone"
          type="tel"
          value={formData.contactPhone}
          onChange={(v) => updateField("contactPhone", v)}
        />
      </div>

      <Field
        label="Company registration number"
        value={formData.companyRegistrationNo}
        onChange={(v) => updateField("companyRegistrationNo", v)}
      />

      <hr className="border-slate-200" />

      <h3 className="text-sm font-semibold text-slate-800">CQC Registration (Optional)</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="CQC Provider ID"
          value={formData.cqcProviderId}
          onChange={(v) => updateField("cqcProviderId", v)}
        />
        <Field
          label="CQC Provider name"
          value={formData.cqcProviderName}
          onChange={(v) => updateField("cqcProviderName", v)}
        />
      </div>

      <Field
        label="CQC Registered manager"
        value={formData.cqcRegisteredManager}
        onChange={(v) => updateField("cqcRegisteredManager", v)}
      />

      <hr className="border-slate-200" />

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Timezone
          <select
            value={formData.timezone}
            onChange={(e) => updateField("timezone", e.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
          >
            <option value="Europe/London">Europe/London</option>
            <option value="UTC">UTC</option>
          </select>
        </label>
      </div>

      {message && (
        <p className={`text-sm ${isError ? "text-rose-600" : "text-emerald-600"}`}>
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="h-10 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  required = false,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
      />
    </label>
  );
}
