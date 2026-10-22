import { NextResponse } from "next/server";
import { hasValidOrigin, jsonError, privateJson, validationError } from "@/lib/api";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenant";
import { onboardingProgressSchema, onboardingProfileSchema } from "@/lib/validation";

/**
 * GET /api/v1/onboarding
 * Get current organisation's onboarding status
 */
export async function GET() {
  try {
    const context = await resolveTenantContext();

    const onboarding = await db.organisationOnboarding.findUnique({
      where: { organisationId: context.organisation.id },
      select: {
        id: true,
        status: true,
        currentStep: true,
        completedSteps: true,
        profileCompleted: true,
        branchesCompleted: true,
        servicesCompleted: true,
        teamCompleted: true,
        reviewCompleted: true,
        lastStepAt: true,
        completedAt: true,
        activatedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Also get org and branch data needed for wizard
    const [organisation, branches, staffCount] = await Promise.all([
      db.organisation.findUnique({
        where: { id: context.organisation.id },
        select: {
          id: true,
          name: true,
          tradingName: true,
          brandName: true,
          brandColour: true,
          companyRegistrationNo: true,
          contactEmail: true,
          contactPhone: true,
          registeredAddressLine1: true,
          registeredAddressLine2: true,
          registeredCity: true,
          registeredPostcode: true,
          cqcProviderId: true,
          cqcProviderName: true,
          cqcRegisteredManager: true,
          status: true,
        },
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
        },
        orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }],
      }),
      db.staffProfile.count({
        where: { organisationId: context.organisation.id },
      }),
    ]);

    return privateJson({
      data: {
        onboarding,
        organisation,
        branches,
        staffCount,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * PATCH /api/v1/onboarding
 * Update onboarding progress
 */
export async function PATCH(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "organisation:update");

    const body = await request.json();

    // Check what type of update this is
    if (body.step === "profile") {
      // Profile update
      const parsed = onboardingProfileSchema.safeParse(body.data);
      if (!parsed.success) {
        return validationError(parsed.error.flatten());
      }

      const data = parsed.data;

      await db.$transaction(async (tx) => {
        // Update organisation
        await tx.organisation.update({
          where: { id: context.organisation.id },
          data: {
            name: data.name,
            tradingName: data.tradingName,
            companyRegistrationNo: data.companyRegistrationNo,
            contactEmail: data.contactEmail,
            contactPhone: data.contactPhone,
            registeredAddressLine1: data.registeredAddressLine1,
            registeredAddressLine2: data.registeredAddressLine2,
            registeredCity: data.registeredCity,
            registeredPostcode: data.registeredPostcode,
            cqcProviderId: data.cqcProviderId,
            cqcProviderName: data.cqcProviderName,
            cqcRegisteredManager: data.cqcRegisteredManager,
          },
        });

        // Update onboarding
        await tx.organisationOnboarding.upsert({
          where: { organisationId: context.organisation.id },
          create: {
            organisationId: context.organisation.id,
            status: "IN_PROGRESS",
            currentStep: 1,
            completedSteps: [0],
            profileCompleted: true,
            lastStepAt: new Date(),
          },
          update: {
            status: "IN_PROGRESS",
            profileCompleted: true,
            lastStepAt: new Date(),
            completedSteps: { push: 0 },
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            organisationId: context.organisation.id,
            actorUserId: context.userId,
            actorMembershipId: context.membership.id,
            action: "onboarding.profile_completed",
            entityType: "Organisation",
            entityId: context.organisation.id,
          },
        });
      });

      return privateJson({ data: { step: "profile", completed: true } });
    }

    // Generic progress update
    const parsed = onboardingProgressSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten());
    }

    const progress = parsed.data;

    const onboarding = await db.organisationOnboarding.upsert({
      where: { organisationId: context.organisation.id },
      create: {
        organisationId: context.organisation.id,
        status: "IN_PROGRESS",
        currentStep: progress.currentStep,
        profileCompleted: progress.profileCompleted ?? false,
        branchesCompleted: progress.branchesCompleted ?? false,
        servicesCompleted: progress.servicesCompleted ?? false,
        teamCompleted: progress.teamCompleted ?? false,
        reviewCompleted: progress.reviewCompleted ?? false,
        lastStepAt: new Date(),
      },
      update: {
        currentStep: progress.currentStep,
        ...(progress.profileCompleted !== undefined
          ? { profileCompleted: progress.profileCompleted }
          : {}),
        ...(progress.branchesCompleted !== undefined
          ? { branchesCompleted: progress.branchesCompleted }
          : {}),
        ...(progress.servicesCompleted !== undefined
          ? { servicesCompleted: progress.servicesCompleted }
          : {}),
        ...(progress.teamCompleted !== undefined
          ? { teamCompleted: progress.teamCompleted }
          : {}),
        ...(progress.reviewCompleted !== undefined
          ? { reviewCompleted: progress.reviewCompleted }
          : {}),
        lastStepAt: new Date(),
      },
    });

    return privateJson({ data: onboarding });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * POST /api/v1/onboarding/activate
 * Activate the organisation after completing onboarding
 */
export async function POST(request: Request) {
  try {
    if (!hasValidOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const context = await resolveTenantContext();
    assertPermission(context.membership, "organisation:update");

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action !== "activate") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    // Check onboarding status
    const onboarding = await db.organisationOnboarding.findUnique({
      where: { organisationId: context.organisation.id },
    });

    if (!onboarding) {
      return NextResponse.json(
        { error: "Onboarding record not found." },
        { status: 404 }
      );
    }

    // Require at least profile and branches to be completed
    if (!onboarding.profileCompleted) {
      return NextResponse.json(
        { error: "Please complete your organisation profile before activating." },
        { status: 400 }
      );
    }

    // Check there's at least one branch
    const branchCount = await db.branch.count({
      where: { organisationId: context.organisation.id, status: "ACTIVE" },
    });

    if (branchCount === 0) {
      return NextResponse.json(
        { error: "Please set up at least one branch before activating." },
        { status: 400 }
      );
    }

    // Activate organisation and update onboarding
    await db.$transaction(async (tx) => {
      await tx.organisation.update({
        where: { id: context.organisation.id },
        data: { status: "ACTIVE" },
      });

      await tx.organisationOnboarding.update({
        where: { organisationId: context.organisation.id },
        data: {
          status: "ACTIVE",
          reviewCompleted: true,
          completedAt: new Date(),
          activatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organisationId: context.organisation.id,
          actorUserId: context.userId,
          actorMembershipId: context.membership.id,
          action: "organisation.activated",
          entityType: "Organisation",
          entityId: context.organisation.id,
        },
      });
    });

    return privateJson({
      data: { activated: true, message: "Organisation activated successfully." },
    });
  } catch (error) {
    return jsonError(error);
  }
}
