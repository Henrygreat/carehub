"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewBranchForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    phone: "",
    email: "",
    serviceArea: "",
    cqcLocationId: "",
    isHeadOffice: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/v1/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          addressLine1: formData.addressLine1.trim() || null,
          addressLine2: formData.addressLine2.trim() || null,
          city: formData.city.trim() || null,
          postcode: formData.postcode.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          serviceArea: formData.serviceArea.trim() || null,
          cqcLocationId: formData.cqcLocationId.trim() || null,
          isHeadOffice: formData.isHeadOffice,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to create branch.");
      }

      router.push(`/settings/branches/${result.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setBusy(false);
    }
  }

  function updateField(field: keyof typeof formData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Branch name"
          value={formData.name}
          onChange={(v) => updateField("name", v)}
          required
          placeholder="e.g., North London Office"
        />
        <Field
          label="Branch code"
          value={formData.code}
          onChange={(v) => updateField("code", v.toUpperCase())}
          required
          placeholder="e.g., NLO"
          pattern="[A-Z0-9-]+"
          maxLength={20}
        />
      </div>

      <p className="text-xs text-slate-500">
        Branch code must be unique and use uppercase letters, numbers, and hyphens only.
      </p>

      <Field
        label="Service area"
        value={formData.serviceArea}
        onChange={(v) => updateField("serviceArea", v)}
        placeholder="e.g., North London, Barnet, Enfield"
      />

      <hr className="border-slate-200" />

      <h3 className="text-sm font-semibold text-slate-800">Address</h3>

      <Field
        label="Address line 1"
        value={formData.addressLine1}
        onChange={(v) => updateField("addressLine1", v)}
      />

      <Field
        label="Address line 2"
        value={formData.addressLine2}
        onChange={(v) => updateField("addressLine2", v)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="City"
          value={formData.city}
          onChange={(v) => updateField("city", v)}
        />
        <Field
          label="Postcode"
          value={formData.postcode}
          onChange={(v) => updateField("postcode", v)}
        />
      </div>

      <hr className="border-slate-200" />

      <h3 className="text-sm font-semibold text-slate-800">Contact</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Phone"
          type="tel"
          value={formData.phone}
          onChange={(v) => updateField("phone", v)}
        />
        <Field
          label="Email"
          type="email"
          value={formData.email}
          onChange={(v) => updateField("email", v)}
        />
      </div>

      <hr className="border-slate-200" />

      <Field
        label="CQC Location ID (optional)"
        value={formData.cqcLocationId}
        onChange={(v) => updateField("cqcLocationId", v)}
      />

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.isHeadOffice}
          onChange={(e) => updateField("isHeadOffice", e.target.checked)}
          className="size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        <span className="text-sm font-medium text-slate-700">
          Set as head office
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-lg bg-teal-700 px-6 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create Branch"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/settings/branches")}
          className="h-11 rounded-lg px-6 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  required = false,
  placeholder,
  pattern,
  maxLength,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  pattern?: string;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        pattern={pattern}
        maxLength={maxLength}
        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
      />
    </label>
  );
}
