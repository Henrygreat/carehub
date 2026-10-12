"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { clientSchema } from "@/lib/validation";

type ClientFormValues = {
  clientReference: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  careNotes: string;
  status: string;
};

type InitialClient = Partial<ClientFormValues>;

const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10";
const labelClass = "block text-sm font-medium text-slate-700";

export function ClientForm({ id, initial }: { id?: string; initial?: InitialClient }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const form = useForm<ClientFormValues>({
    defaultValues: {
      clientReference: initial?.clientReference ?? "",
      firstName: initial?.firstName ?? "",
      lastName: initial?.lastName ?? "",
      preferredName: initial?.preferredName ?? "",
      dateOfBirth: initial?.dateOfBirth ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      addressLine1: initial?.addressLine1 ?? "",
      addressLine2: initial?.addressLine2 ?? "",
      city: initial?.city ?? "",
      postcode: initial?.postcode ?? "",
      careNotes: initial?.careNotes ?? "",
      status: initial?.status ?? "ACTIVE",
    },
  });

  async function submit(values: ClientFormValues) {
    setMessage("");
    // Transform empty strings to null for optional fields
    const transformed = {
      ...values,
      preferredName: values.preferredName || null,
      dateOfBirth: values.dateOfBirth || null,
      email: values.email || null,
      phone: values.phone || null,
      addressLine1: values.addressLine1 || null,
      addressLine2: values.addressLine2 || null,
      city: values.city || null,
      postcode: values.postcode || null,
      careNotes: values.careNotes || null,
    };
    const parsed = clientSchema.safeParse(transformed);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && field in values) {
          form.setError(field as keyof ClientFormValues, { message: issue.message });
        }
      });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(id ? `/api/v1/clients/${id}` : "/api/v1/clients", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save client.");
      router.push(`/clients/${result.data.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save client.");
    } finally {
      setBusy(false);
    }
  }

  const errorFor = (field: keyof ClientFormValues) => form.formState.errors[field]?.message;
  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
      {message && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</p>}

      <fieldset className="space-y-5">
        <legend className="text-sm font-semibold text-slate-900">Basic information</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Client reference" name="clientReference" register={form.register} error={errorFor("clientReference")} required />
          <label className={labelClass}>
            Status
            <select className={fieldClass} {...form.register("status")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <Field label="First name" name="firstName" register={form.register} error={errorFor("firstName")} required />
          <Field label="Last name" name="lastName" register={form.register} error={errorFor("lastName")} required />
          <Field label="Preferred name" name="preferredName" register={form.register} error={errorFor("preferredName")} />
          <Field label="Date of birth" name="dateOfBirth" type="date" register={form.register} error={errorFor("dateOfBirth")} />
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-slate-200 pt-5">
        <legend className="text-sm font-semibold text-slate-900">Contact details</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" name="email" type="email" register={form.register} error={errorFor("email")} />
          <Field label="Phone" name="phone" type="tel" register={form.register} error={errorFor("phone")} />
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-slate-200 pt-5">
        <legend className="text-sm font-semibold text-slate-900">Address</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Address line 1" name="addressLine1" register={form.register} error={errorFor("addressLine1")} />
          <Field label="Address line 2" name="addressLine2" register={form.register} error={errorFor("addressLine2")} />
          <Field label="City" name="city" register={form.register} error={errorFor("city")} />
          <Field label="Postcode" name="postcode" register={form.register} error={errorFor("postcode")} />
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-slate-200 pt-5">
        <legend className="text-sm font-semibold text-slate-900">Care information</legend>
        <label className={labelClass}>
          Care notes
          <textarea
            className="mt-1.5 min-h-[120px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10"
            {...form.register("careNotes")}
            aria-invalid={Boolean(errorFor("careNotes"))}
          />
          {errorFor("careNotes") && <span className="mt-1 block text-xs text-rose-700">{errorFor("careNotes")}</span>}
        </label>
      </fieldset>

      <div className="flex items-center gap-3 border-t border-slate-200 pt-5">
        <button
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? "Saving…" : id ? "Save changes" : "Register client"}
        </button>
        <a href={id ? `/clients/${id}` : "/clients"} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</a>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  register,
  error,
  required = false,
}: {
  label: string;
  name: keyof ClientFormValues;
  type?: string;
  register: ReturnType<typeof useForm<ClientFormValues>>["register"];
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}{required && <span className="text-rose-500"> *</span>}
      <input
        className={fieldClass}
        type={type}
        {...register(name)}
        aria-invalid={Boolean(error)}
      />
      {error && <span className="mt-1 block text-xs text-rose-700">{error}</span>}
    </label>
  );
}
