"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { staffSchema } from "@/lib/validation";

type StaffFormValues = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employmentStatus: string;
  employmentType: string;
  jobTitle: string;
  startDate: string;
  contractedWeeklyHours: string;
};

type InitialStaff = Partial<StaffFormValues>;

const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10";
const labelClass = "block text-sm font-medium text-slate-700";

export function StaffForm({ id, initial }: { id?: string; initial?: InitialStaff }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const form = useForm<StaffFormValues>({
    defaultValues: {
      employeeNumber: initial?.employeeNumber ?? "",
      firstName: initial?.firstName ?? "",
      lastName: initial?.lastName ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      employmentStatus: initial?.employmentStatus ?? "ACTIVE",
      employmentType: initial?.employmentType ?? "FULL_TIME",
      jobTitle: initial?.jobTitle ?? "",
      startDate: initial?.startDate?.slice(0, 10) ?? "",
      contractedWeeklyHours: initial?.contractedWeeklyHours ?? "37.5",
    },
  });

  async function submit(values: StaffFormValues) {
    setMessage("");
    const parsed = staffSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && field in values) {
          form.setError(field as keyof StaffFormValues, { message: issue.message });
        }
      });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(id ? `/api/v1/staff/${id}` : "/api/v1/staff", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save staff member.");
      router.push(`/staff/${result.data.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save staff member.");
    } finally {
      setBusy(false);
    }
  }

  const errorFor = (field: keyof StaffFormValues) => form.formState.errors[field]?.message;
  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
      {message && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Employee number" name="employeeNumber" register={form.register} error={errorFor("employeeNumber")} />
        <Field label="Job title" name="jobTitle" register={form.register} error={errorFor("jobTitle")} />
        <Field label="First name" name="firstName" register={form.register} error={errorFor("firstName")} />
        <Field label="Last name" name="lastName" register={form.register} error={errorFor("lastName")} />
        <Field label="Work email" name="email" type="email" register={form.register} error={errorFor("email")} />
        <Field label="Phone" name="phone" type="tel" register={form.register} error={errorFor("phone")} />
        <label className={labelClass}>
          Employment status
          <select className={fieldClass} {...form.register("employmentStatus")}>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On leave</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <label className={labelClass}>
          Employment type
          <select className={fieldClass} {...form.register("employmentType")}>
            <option value="FULL_TIME">Full time</option>
            <option value="PART_TIME">Part time</option>
            <option value="ZERO_HOURS">Zero hours</option>
            <option value="CONTRACTOR">Contractor</option>
            <option value="TEMPORARY">Temporary</option>
          </select>
        </label>
        <Field label="Start date" name="startDate" type="date" register={form.register} error={errorFor("startDate")} />
        <Field label="Contracted weekly hours" name="contractedWeeklyHours" type="number" register={form.register} error={errorFor("contractedWeeklyHours")} />
      </div>
      <div className="flex items-center gap-3 border-t border-slate-200 pt-5">
        <button
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? "Saving…" : id ? "Save changes" : "Create staff profile"}
        </button>
        <a href={id ? `/staff/${id}` : "/staff"} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</a>
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
}: {
  label: string;
  name: keyof StaffFormValues;
  type?: string;
  register: ReturnType<typeof useForm<StaffFormValues>>["register"];
  error?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className={fieldClass}
        type={type}
        step={type === "number" ? "0.25" : undefined}
        {...register(name, { required: type !== "tel" })}
        aria-invalid={Boolean(error)}
      />
      {error && <span className="mt-1 block text-xs text-rose-700">{error}</span>}
    </label>
  );
}
