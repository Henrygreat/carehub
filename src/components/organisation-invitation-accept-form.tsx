"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

type Props = {
  token: string;
};

export function OrganisationInvitationAcceptForm({ token }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/v1/auth/organisation-invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to accept invitation.");
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
      <div className="space-y-6 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle size={32} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Welcome to FalconCare Hub!
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Your account has been created. Sign in to complete your organisation setup.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          Sign in and complete setup
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-500">
          Create a secure password for your administrator account. You will use this to sign in
          and manage your organisation.
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
          className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
          placeholder="Minimum 12 characters"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Confirm password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={12}
          className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
          placeholder="Re-enter your password"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50"
      >
        {busy ? "Creating your account..." : "Complete Setup"}
      </button>

      <p className="text-center text-xs text-slate-400">
        By continuing, you agree to the terms of service.
      </p>
    </form>
  );
}
