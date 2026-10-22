"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MapPin,
  Rocket,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";

type OnboardingData = {
  id: string;
  status: string;
  currentStep: number;
  profileCompleted: boolean;
  branchesCompleted: boolean;
  servicesCompleted: boolean;
  teamCompleted: boolean;
  reviewCompleted: boolean;
} | null;

type Branch = {
  id: string;
  name: string;
  code: string;
  status: string;
  isHeadOffice: boolean;
  city: string | null;
  postcode: string | null;
};

type Props = {
  organisation: {
    id: string;
    name: string;
    status: string;
  };
  onboarding: OnboardingData;
  branches: Branch[];
  staffCount: number;
  pendingInvitations: number;
};

const steps = [
  {
    id: 0,
    name: "Organisation Profile",
    description: "Company details and contact information",
    icon: Building2,
    href: "/settings/organisation",
    required: true,
  },
  {
    id: 1,
    name: "Branch Setup",
    description: "Set up your office locations",
    icon: MapPin,
    href: "/settings/branches",
    required: true,
  },
  {
    id: 2,
    name: "Services & Settings",
    description: "Configure your care services",
    icon: Settings,
    href: "/settings/organisation",
    required: false,
  },
  {
    id: 3,
    name: "Team Setup",
    description: "Invite your staff members",
    icon: Users,
    href: "/settings/users",
    required: false,
  },
  {
    id: 4,
    name: "Review & Activate",
    description: "Review and launch your organisation",
    icon: Rocket,
    href: null,
    required: true,
  },
];

export function OnboardingWizard({
  organisation,
  onboarding,
  branches,
  staffCount,
  pendingInvitations,
}: Props) {
  const router = useRouter();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");

  const currentStep = onboarding?.currentStep ?? 0;

  const stepStatus = {
    profile: onboarding?.profileCompleted ?? false,
    branches: branches.length > 0,
    services: true, // Optional, mark as done
    team: staffCount > 0 || pendingInvitations > 0,
    review: onboarding?.reviewCompleted ?? false,
  };

  const completedCount = [
    stepStatus.profile,
    stepStatus.branches,
    stepStatus.services,
    stepStatus.team,
  ].filter(Boolean).length;

  const progressPercent = Math.round((completedCount / 4) * 100);

  const canActivate = stepStatus.profile && stepStatus.branches;

  async function handleActivate() {
    setActivating(true);
    setError("");

    try {
      const response = await fetch("/api/v1/onboarding?action=activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to activate organisation.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <section className="text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-teal-100 text-teal-700">
          <Rocket size={32} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Welcome to FalconCare Hub
        </h1>
        <p className="mt-2 text-slate-500">
          Let&apos;s get <strong>{organisation.name}</strong> set up and ready to manage care.
        </p>
      </section>

      {/* Progress */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Setup Progress</h2>
            <p className="text-sm text-slate-500">
              {completedCount} of 4 steps completed
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-teal-700">{progressPercent}%</span>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-600 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </section>

      {/* Steps */}
      <section className="space-y-3">
        {steps.map((step, index) => {
          const isCompleted =
            (step.id === 0 && stepStatus.profile) ||
            (step.id === 1 && stepStatus.branches) ||
            (step.id === 2 && stepStatus.services) ||
            (step.id === 3 && stepStatus.team) ||
            (step.id === 4 && stepStatus.review);

          const isCurrent = step.id === currentStep;
          const Icon = step.icon;

          if (step.id === 4) {
            // Review & Activate step
            return (
              <div
                key={step.id}
                className={`rounded-2xl border p-6 transition ${
                  canActivate
                    ? "border-teal-200 bg-teal-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`grid size-12 shrink-0 place-items-center rounded-xl ${
                      canActivate ? "bg-teal-200 text-teal-700" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <Icon size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{step.name}</h3>
                      {step.required && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{step.description}</p>

                    {/* Checklist */}
                    <div className="mt-4 space-y-2">
                      <ChecklistItem
                        label="Organisation profile completed"
                        checked={stepStatus.profile}
                      />
                      <ChecklistItem
                        label="At least one branch set up"
                        checked={stepStatus.branches}
                      />
                      <ChecklistItem
                        label="Services configured (optional)"
                        checked={stepStatus.services}
                        optional
                      />
                      <ChecklistItem
                        label="Team members invited (optional)"
                        checked={stepStatus.team}
                        optional
                      />
                    </div>

                    {error && (
                      <p className="mt-3 text-sm text-rose-600">{error}</p>
                    )}

                    <button
                      onClick={handleActivate}
                      disabled={!canActivate || activating}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50"
                    >
                      {activating ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Activating...
                        </>
                      ) : (
                        <>
                          <Rocket size={16} />
                          Activate Organisation
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={step.id}
              href={step.href!}
              className={`flex items-center gap-4 rounded-2xl border p-6 transition hover:border-teal-200 hover:bg-teal-50/50 ${
                isCompleted
                  ? "border-emerald-200 bg-emerald-50/50"
                  : isCurrent
                    ? "border-teal-200 bg-white"
                    : "border-slate-200 bg-white"
              }`}
            >
              <div
                className={`grid size-12 shrink-0 place-items-center rounded-xl ${
                  isCompleted
                    ? "bg-emerald-100 text-emerald-600"
                    : isCurrent
                      ? "bg-teal-100 text-teal-700"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{step.name}</h3>
                  {step.required && !isCompleted && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                      Required
                    </span>
                  )}
                  {isCompleted && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                      Complete
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">{step.description}</p>
                {step.id === 1 && branches.length > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {branches.length} {branches.length === 1 ? "branch" : "branches"} configured
                  </p>
                )}
                {step.id === 3 && (staffCount > 0 || pendingInvitations > 0) && (
                  <p className="mt-1 text-xs text-slate-400">
                    {staffCount} staff, {pendingInvitations} pending invitations
                  </p>
                )}
              </div>
              <ChevronRight size={20} className="shrink-0 text-slate-400" />
            </Link>
          );
        })}
      </section>

      {/* Skip for now */}
      <section className="text-center">
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Continue to dashboard (you can complete setup later)
        </Link>
      </section>
    </div>
  );
}

function ChecklistItem({
  label,
  checked,
  optional = false,
}: {
  label: string;
  checked: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {checked ? (
        <CheckCircle2 size={16} className="text-emerald-600" />
      ) : (
        <div
          className={`size-4 rounded-full border-2 ${
            optional ? "border-slate-300" : "border-amber-400"
          }`}
        />
      )}
      <span className={checked ? "text-slate-700" : "text-slate-500"}>
        {label}
      </span>
    </div>
  );
}
