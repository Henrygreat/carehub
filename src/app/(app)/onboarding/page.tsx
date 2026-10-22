import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { resolveTenantContext } from "@/lib/tenant";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const context = await resolveTenantContext();

  // Check if organisation is already fully active
  if (context.organisation.status === "ACTIVE") {
    const onboarding = await db.organisationOnboarding.findUnique({
      where: { organisationId: context.organisation.id },
      select: { activatedAt: true },
    });

    // If already activated, redirect to dashboard
    if (onboarding?.activatedAt) {
      redirect("/dashboard");
    }
  }

  // Get onboarding data
  const [onboarding, branches, staffCount, invitationCount] = await Promise.all([
    db.organisationOnboarding.findUnique({
      where: { organisationId: context.organisation.id },
    }),
    db.branch.findMany({
      where: { organisationId: context.organisation.id },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        isHeadOffice: true,
        city: true,
        postcode: true,
      },
      orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }],
    }),
    db.staffProfile.count({
      where: { organisationId: context.organisation.id },
    }),
    db.invitation.count({
      where: {
        organisationId: context.organisation.id,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);

  return (
    <div className="min-h-[80vh]">
      <OnboardingWizard
        organisation={{
          id: context.organisation.id,
          name: context.organisation.name,
          status: context.organisation.status,
        }}
        onboarding={onboarding}
        branches={branches}
        staffCount={staffCount}
        pendingInvitations={invitationCount}
      />
    </div>
  );
}
