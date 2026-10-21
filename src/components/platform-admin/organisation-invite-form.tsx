"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, CheckCircle } from "lucide-react";

export function OrganisationInviteForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    organisationName: "",
    tradingName: "",
    companyRegistrationNo: "",
    contactEmail: "",
    contactPhone: "",
    registeredAddressLine1: "",
    registeredCity: "",
    registeredPostcode: "",
    primaryAdminName: "",
    primaryAdminEmail: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInvitationToken("");

    try {
      const response = await fetch("/api/v1/platform-admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationName: formData.organisationName.trim(),
          tradingName: formData.tradingName.trim() || null,
          companyRegistrationNo: formData.companyRegistrationNo.trim() || null,
          contactEmail: formData.contactEmail.trim(),
          contactPhone: formData.contactPhone.trim() || null,
          registeredAddressLine1: formData.registeredAddressLine1.trim() || null,
          registeredCity: formData.registeredCity.trim() || null,
          registeredPostcode: formData.registeredPostcode.trim() || null,
          primaryAdminName: formData.primaryAdminName.trim(),
          primaryAdminEmail: formData.primaryAdminEmail.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to create invitation.");
      }

      setInvitationToken(result.data.token);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setBusy(false);
    }
  }

  function updateField(field: keyof typeof formData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function copyInviteLink() {
    const link = `${window.location.origin}/organisation-invite/${invitationToken}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function resetForm() {
    setFormData({
      organisationName: "",
      tradingName: "",
      companyRegistrationNo: "",
      contactEmail: "",
      contactPhone: "",
      registeredAddressLine1: "",
      registeredCity: "",
      registeredPostcode: "",
      primaryAdminName: "",
      primaryAdminEmail: "",
    });
    setInvitationToken("");
    setError("");
  }

  if (invitationToken) {
    return (
      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle size={18} />
            <span className="font-medium">Invitation created successfully!</span>
          </div>
          <p className="mt-2 text-sm text-emerald-600">
            Share this link with the organisation administrator to complete registration.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">Invitation Link</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate text-sm text-slate-700">
              {window.location.origin}/organisation-invite/{invitationToken}
            </code>
            <button
              onClick={copyInviteLink}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
            >
              {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          This link expires in 7 days. The token is shown only once and cannot be retrieved.
        </p>

        <button
          onClick={resetForm}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Invite another organisation
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">Organisation Details</h3>

      <Field
        label="Organisation name"
        value={formData.organisationName}
        onChange={(v) => updateField("organisationName", v)}
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Trading name (optional)"
          value={formData.tradingName}
          onChange={(v) => updateField("tradingName", v)}
        />
        <Field
          label="Company reg. number"
          value={formData.companyRegistrationNo}
          onChange={(v) => updateField("companyRegistrationNo", v)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Contact email"
          type="email"
          value={formData.contactEmail}
          onChange={(v) => updateField("contactEmail", v)}
          required
        />
        <Field
          label="Contact phone"
          type="tel"
          value={formData.contactPhone}
          onChange={(v) => updateField("contactPhone", v)}
        />
      </div>

      <hr className="border-slate-200" />

      <h3 className="text-sm font-semibold text-slate-800">Primary Administrator</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Admin name"
          value={formData.primaryAdminName}
          onChange={(v) => updateField("primaryAdminName", v)}
          required
        />
        <Field
          label="Admin email"
          type="email"
          value={formData.primaryAdminEmail}
          onChange={(v) => updateField("primaryAdminEmail", v)}
          required
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="h-10 w-full rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
      >
        {busy ? "Creating invitation..." : "Create Invitation"}
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
        className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
      />
    </label>
  );
}
