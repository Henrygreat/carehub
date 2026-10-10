import { LoginForm } from "@/components/auth-forms";
import { AuthCard } from "@/components/auth-card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard eyebrow="Welcome back" title="Sign in to your workspace" description="Your team, thoughtfully organised.">
      <LoginForm error={params.error} />
    </AuthCard>
  );
}
