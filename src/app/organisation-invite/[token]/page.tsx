import { AuthCard } from "@/components/auth-card";
import { OrganisationInvitationAcceptForm } from "@/components/organisation-invitation-accept-form";

export default async function OrganisationInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <AuthCard
      eyebrow="Welcome to FalconCare Hub"
      title="Set up your organisation"
      description="Create your administrator account to complete your organisation setup."
    >
      <OrganisationInvitationAcceptForm token={token} />
    </AuthCard>
  );
}
