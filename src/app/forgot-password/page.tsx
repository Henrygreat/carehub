import { AuthCard } from "@/components/auth-card";
import { PasswordResetRequestForm } from "@/components/auth-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthCard eyebrow="Account recovery" title="Reset your password" description="Enter your work email and we’ll send a secure reset link.">
      <PasswordResetRequestForm />
    </AuthCard>
  );
}
