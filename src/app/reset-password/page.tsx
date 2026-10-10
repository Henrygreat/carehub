import { AuthCard } from "@/components/auth-card";
import { ResetPasswordClient } from "@/components/reset-password-client";

export default function ResetPasswordPage() {
  return (
    <AuthCard eyebrow="Account recovery" title="Choose a new password" description="Set a new password to securely access your workspace.">
      <ResetPasswordClient />
    </AuthCard>
  );
}
