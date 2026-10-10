"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10";
const labelClass = "block text-sm font-medium text-slate-700";
const buttonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60";

export function LoginForm({ error }: { error?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(
    error ? "Email or password is incorrect. Please try again." : "",
  );
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      });
      if (result?.error) {
        setMessage("Email or password is incorrect. Please try again.");
      } else {
        router.replace("/dashboard");
        router.refresh();
      }
    } catch {
      setMessage("Unable to sign in right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="space-y-5">
      <label className={labelClass}>
        Work email
        <input className={inputClass} type="email" name="email" autoComplete="email" required />
      </label>
      <label className={labelClass}>
        Password
        <input className={inputClass} type="password" name="password" autoComplete="current-password" required />
      </label>
      {message && <p role="alert" className="text-sm text-rose-700">{message}</p>}
      <button className={buttonClass} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-teal-700 hover:text-teal-900">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}

export function PasswordResetRequestForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const email = new FormData(event.currentTarget).get("email");
    try {
      const response = await fetch("/api/v1/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("Request failed");
      setMessage("If an account matches that email, reset instructions will be sent.");
    } catch {
      setMessage("We could not process the request. Please try again shortly.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <label className={labelClass}>Work email<input className={inputClass} type="email" name="email" required /></label>
      {message && <p role="status" className="text-sm text-slate-600">{message}</p>}
      <button className={buttonClass} disabled={busy}>{busy ? "Sending…" : "Send reset instructions"}</button>
      <BackToLogin />
    </form>
  );
}

export function PasswordResetConfirmForm({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const password = new FormData(event.currentTarget).get("password");
    try {
      const response = await fetch("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) throw new Error("Reset failed");
      setMessage("Password updated. You can now sign in.");
      window.setTimeout(() => router.replace("/login"), 1200);
    } catch {
      setMessage("This reset link is invalid or expired, or the new password could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <label className={labelClass}>New password<input className={inputClass} type="password" name="password" minLength={12} required /></label>
      <p className="text-xs text-slate-500">Use at least 12 characters.</p>
      {message && <p role="status" className="text-sm text-slate-600">{message}</p>}
      <button className={buttonClass} disabled={busy}>{busy ? "Updating…" : "Set new password"}</button>
    </form>
  );
}

export function InvitationAcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/auth/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: form.get("name"), password: form.get("password") }),
      });
      if (!response.ok) throw new Error("Invitation not accepted");
      setMessage("Your account is ready. Redirecting to sign in…");
      window.setTimeout(() => router.replace("/login"), 1200);
    } catch {
      setMessage("This invitation is invalid or expired, or an account already has access.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <label className={labelClass}>Full name<input className={inputClass} name="name" autoComplete="name" required minLength={2} /></label>
      <label className={labelClass}>Password<input className={inputClass} name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
      <p className="text-xs text-slate-500">Use at least 12 characters.</p>
      {message && <p role="status" className="text-sm text-slate-600">{message}</p>}
      <button className={buttonClass} disabled={busy}>{busy ? "Setting up…" : "Accept invitation"}</button>
    </form>
  );
}

function BackToLogin() {
  return <p className="text-center text-sm"><Link href="/login" className="font-medium text-teal-700 hover:text-teal-900">Back to sign in</Link></p>;
}
