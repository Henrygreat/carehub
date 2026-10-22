import { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { ApplicationForm } from "@/components/application-form";

export const metadata: Metadata = {
  title: "Apply to Join | FalconCare Hub",
  description: "Apply to join FalconCare Hub - the care management platform for UK domiciliary care providers.",
};

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-teal-700 text-base font-bold text-white">
              F
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">
              FalconCare Hub
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-teal-100 text-teal-700">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Join FalconCare Hub
              </h1>
              <p className="text-slate-500">
                Apply to register your care organisation
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 rounded-xl bg-teal-50 p-4">
            <h2 className="font-medium text-teal-800">What happens next?</h2>
            <ol className="mt-2 space-y-1 text-sm text-teal-700">
              <li>1. Submit your application below</li>
              <li>2. Our team will review your details within 2 business days</li>
              <li>3. Once approved, you'll receive an invitation email</li>
              <li>4. Set up your organisation and start managing care</li>
            </ol>
          </div>

          <ApplicationForm />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-teal-700 hover:text-teal-800">
            Sign in here
          </Link>
        </p>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-4xl px-5 text-center text-sm text-slate-500">
          <p>FalconCare Hub · Thoughtful tools for better care teams</p>
          <p className="mt-2">
            <Link href="/privacy" className="hover:text-slate-700">Privacy Policy</Link>
            {" · "}
            <Link href="/terms" className="hover:text-slate-700">Terms of Service</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
