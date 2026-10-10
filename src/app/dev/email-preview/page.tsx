import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { renderInvitationEmail, renderPasswordResetEmail } from "@/lib/email-templates";
import { requireAppUrl } from "@/lib/environment";

export const dynamic = "force-dynamic";

export default function DevelopmentEmailPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const baseUrl =
    process.env.APP_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  const appUrl = requireAppUrl(baseUrl);
  const invitation = renderInvitationEmail({
    organisationName: "Falcon Carers Demo",
    role: "CARE_WORKER",
    acceptUrl: new URL("/invite/DEVELOPMENT-PREVIEW-ONLY", appUrl).toString(),
    expiresAt: new Date("2030-01-08T12:00:00.000Z"),
  });
  const passwordReset = renderPasswordResetEmail({
    resetUrl: new URL("/reset-password#token=DEVELOPMENT-PREVIEW-ONLY", appUrl).toString(),
    expiresAt: new Date("2030-01-01T12:00:00.000Z"),
  });

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <h1 className="font-semibold">Development-only email previews</h1>
          <p className="mt-1">These examples use fictional organisation data and invalid preview links. They are rendered locally and never sent to Resend.</p>
        </div>
        <div className="grid gap-8">
          <EmailPreview title="Staff invitation" subject={invitation.subject} html={invitation.html} />
          <EmailPreview title="Password reset" subject={passwordReset.subject} html={passwordReset.html} />
        </div>
      </div>
    </main>
  );
}

function EmailPreview({
  title,
  subject,
  html,
}: {
  title: string;
  subject: string;
  html: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">Subject: {subject}</p>
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </Card>
  );
}
