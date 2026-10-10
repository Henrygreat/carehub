import { AuthCard } from "@/components/auth-card";
import { InvitationAcceptForm } from "@/components/auth-forms";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthCard eyebrow="You’re invited" title="Join your care team" description="Create your secure FalconCare Hub account to accept this invitation.">
      <InvitationAcceptForm token={token} />
    </AuthCard>
  );
}
