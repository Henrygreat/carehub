"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const careServiceOptions = [
  "Personal care",
  "Medication support",
  "Companionship",
  "Domestic support",
  "Live-in care",
  "Complex care",
  "Dementia care",
  "End of life care",
  "Learning disability support",
  "Mental health support",
  "Physical disability support",
  "Reablement",
  "Respite care",
];

type FormData = {
  companyName: string;
  tradingName: string;
  companyRegistrationNo: string;
  registeredAddressLine1: string;
  registeredAddressLine2: string;
  registeredCity: string;
  registeredPostcode: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  careServiceTypes: string[];
  cqcRegistrationNo: string;
  estimatedStaffCount: string;
  estimatedBranchCount: string;
  privacyNoticeAccepted: boolean;
  termsAccepted: boolean;
};

export function ApplicationForm() {
  const [formData, setFormData] = useState<FormData>({
    companyName: "",
    tradingName: "",
    companyRegistrationNo: "",
    registeredAddressLine1: "",
    registeredAddressLine2: "",
    registeredCity: "",
    registeredPostcode: "",
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    careServiceTypes: [],
    cqcRegistrationNo: "",
    estimatedStaffCount: "",
    estimatedBranchCount: "",
    privacyNoticeAccepted: false,
    termsAccepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function toggleService(service: string) {
    setFormData((prev) => ({
      ...prev,
      careServiceTypes: prev.careServiceTypes.includes(service)
        ? prev.careServiceTypes.filter((s) => s !== service)
        : [...prev.careServiceTypes, service],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/v1/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: formData.companyName.trim(),
          tradingName: formData.tradingName.trim() || null,
          companyRegistrationNo: formData.companyRegistrationNo.trim() || null,
          registeredAddressLine1: formData.registeredAddressLine1.trim() || null,
          registeredAddressLine2: formData.registeredAddressLine2.trim() || null,
          registeredCity: formData.registeredCity.trim() || null,
          registeredPostcode: formData.registeredPostcode.trim() || null,
          primaryContactName: formData.primaryContactName.trim(),
          primaryContactEmail: formData.primaryContactEmail.trim(),
          primaryContactPhone: formData.primaryContactPhone.trim() || null,
          careServiceTypes: formData.careServiceTypes,
          cqcRegistrationNo: formData.cqcRegistrationNo.trim() || null,
          estimatedStaffCount: formData.estimatedStaffCount
            ? parseInt(formData.estimatedStaffCount, 10)
            : null,
          estimatedBranchCount: formData.estimatedBranchCount
            ? parseInt(formData.estimatedBranchCount, 10)
            : null,
          privacyNoticeAccepted: formData.privacyNoticeAccepted,
          termsAccepted: formData.termsAccepted,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to submit application.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          Application Submitted
        </h2>
        <p className="mx-auto mt-2 max-w-md text-slate-600">
          Thank you for applying to join FalconCare Hub. We'll review your
          application and contact you at{" "}
          <strong>{formData.primaryContactEmail}</strong> within 2 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Company Details */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Company Details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Registered company name"
            value={formData.companyName}
            onChange={(v) => updateField("companyName", v)}
            required
            placeholder="e.g., Sunrise Care Services Ltd"
          />
          <Field
            label="Trading name (optional)"
            value={formData.tradingName}
            onChange={(v) => updateField("tradingName", v)}
            placeholder="e.g., Sunrise Care"
          />
        </div>
        <div className="mt-4">
          <Field
            label="Company registration number (optional)"
            value={formData.companyRegistrationNo}
            onChange={(v) => updateField("companyRegistrationNo", v)}
            placeholder="e.g., 12345678"
            maxLength={20}
          />
        </div>
      </section>

      {/* Registered Address */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Registered Address
        </h3>
        <div className="space-y-4">
          <Field
            label="Address line 1"
            value={formData.registeredAddressLine1}
            onChange={(v) => updateField("registeredAddressLine1", v)}
          />
          <Field
            label="Address line 2 (optional)"
            value={formData.registeredAddressLine2}
            onChange={(v) => updateField("registeredAddressLine2", v)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="City"
              value={formData.registeredCity}
              onChange={(v) => updateField("registeredCity", v)}
            />
            <Field
              label="Postcode"
              value={formData.registeredPostcode}
              onChange={(v) => updateField("registeredPostcode", v)}
            />
          </div>
        </div>
      </section>

      {/* Primary Contact */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Primary Contact
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          This person will receive the invitation to set up your organisation.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            value={formData.primaryContactName}
            onChange={(v) => updateField("primaryContactName", v)}
            required
            placeholder="e.g., Jane Smith"
          />
          <Field
            label="Business email"
            type="email"
            value={formData.primaryContactEmail}
            onChange={(v) => updateField("primaryContactEmail", v)}
            required
            placeholder="e.g., jane@sunrisecare.co.uk"
          />
        </div>
        <div className="mt-4">
          <Field
            label="Phone number (optional)"
            type="tel"
            value={formData.primaryContactPhone}
            onChange={(v) => updateField("primaryContactPhone", v)}
            placeholder="e.g., 020 1234 5678"
          />
        </div>
      </section>

      {/* Care Services */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Care Services
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Select the types of care services you provide (select at least one).
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {careServiceOptions.map((service) => (
            <label
              key={service}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 transition hover:border-teal-300 hover:bg-teal-50"
            >
              <input
                type="checkbox"
                checked={formData.careServiceTypes.includes(service)}
                onChange={() => toggleService(service)}
                className="size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-slate-700">{service}</span>
            </label>
          ))}
        </div>
      </section>

      {/* CQC & Scale */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Regulatory & Scale
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="CQC registration number (optional)"
            value={formData.cqcRegistrationNo}
            onChange={(v) => updateField("cqcRegistrationNo", v)}
            placeholder="e.g., 1-123456789"
          />
          <Field
            label="Estimated staff count"
            type="number"
            value={formData.estimatedStaffCount}
            onChange={(v) => updateField("estimatedStaffCount", v)}
            placeholder="e.g., 25"
            min={1}
            max={10000}
          />
          <Field
            label="Estimated branches"
            type="number"
            value={formData.estimatedBranchCount}
            onChange={(v) => updateField("estimatedBranchCount", v)}
            placeholder="e.g., 2"
            min={1}
            max={500}
          />
        </div>
      </section>

      {/* Consent */}
      <section className="space-y-3 rounded-xl bg-slate-50 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={formData.privacyNoticeAccepted}
            onChange={(e) => updateField("privacyNoticeAccepted", e.target.checked)}
            required
            className="mt-0.5 size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-sm text-slate-600">
            I have read and agree to the{" "}
            <a href="/privacy" className="font-medium text-teal-700 hover:underline">
              Privacy Notice
            </a>
            . I understand how my data will be processed.
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={formData.termsAccepted}
            onChange={(e) => updateField("termsAccepted", e.target.checked)}
            required
            className="mt-0.5 size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-sm text-slate-600">
            I agree to the{" "}
            <a href="/terms" className="font-medium text-teal-700 hover:underline">
              Terms of Service
            </a>{" "}
            and confirm I am authorised to apply on behalf of this organisation.
          </span>
        </label>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || formData.careServiceTypes.length === 0}
          className="h-11 rounded-lg bg-teal-700 px-8 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Submitting...
            </span>
          ) : (
            "Submit Application"
          )}
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
  maxLength,
  min,
  max,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {required && <span className="ml-1 text-rose-500">*</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
      />
    </label>
  );
}
