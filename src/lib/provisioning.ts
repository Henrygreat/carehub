import "server-only";
import { db } from "@/lib/db";
import { createSecretToken, hashSecretToken } from "@/lib/tokens";
import { generateSlug } from "@/lib/slug";
import { sendOrganisationInvitationEmail } from "@/lib/email";
import { createPlatformAuditLog, type PlatformAdminContext } from "@/lib/platform-admin";

const INVITATION_EXPIRY_DAYS = 7;

export type ProvisioningResult = {
  organisationId: string;
  invitationId: string;
  invitationToken: string;
  emailSent: boolean;
};

/**
 * Provision an organisation from an approved application.
 * This is idempotent - calling multiple times with the same application won't create duplicates.
 */
export async function provisionOrganisationFromApplication(
  applicationId: string,
  context: PlatformAdminContext
): Promise<ProvisioningResult> {
  // Fetch the application
  const application = await db.organisationApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      companyName: true,
      tradingName: true,
      companyRegistrationNo: true,
      registeredAddressLine1: true,
      registeredAddressLine2: true,
      registeredCity: true,
      registeredPostcode: true,
      primaryContactName: true,
      primaryContactEmail: true,
      primaryContactPhone: true,
      cqcRegistrationNo: true,
      organisationId: true,
      invitationId: true,
    },
  });

  if (!application) {
    throw new Error("Application not found.");
  }

  // Check if already provisioned
  if (application.organisationId) {
    throw new Error("Application has already been provisioned.");
  }

  // Generate organisation slug
  const slug = await generateSlug(application.companyName);

  // Generate invitation token
  const token = createSecretToken();
  const tokenHash = hashSecretToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

  // Create organisation, invitation, and onboarding in a transaction
  const result = await db.$transaction(async (tx) => {
    // Create organisation with PENDING status
    const organisation = await tx.organisation.create({
      data: {
        name: application.companyName,
        slug,
        brandName: application.tradingName ?? application.companyName,
        status: "PENDING",
        tradingName: application.tradingName,
        companyRegistrationNo: application.companyRegistrationNo,
        contactEmail: application.primaryContactEmail,
        contactPhone: application.primaryContactPhone,
        registeredAddressLine1: application.registeredAddressLine1,
        registeredAddressLine2: application.registeredAddressLine2,
        registeredCity: application.registeredCity,
        registeredPostcode: application.registeredPostcode,
        cqcProviderId: application.cqcRegistrationNo,
      },
    });

    // Create Head Office branch
    await tx.branch.create({
      data: {
        organisationId: organisation.id,
        name: "Head Office",
        code: "HQ",
        status: "ACTIVE",
        isHeadOffice: true,
        addressLine1: application.registeredAddressLine1,
        addressLine2: application.registeredAddressLine2,
        city: application.registeredCity,
        postcode: application.registeredPostcode,
        phone: application.primaryContactPhone,
        email: application.primaryContactEmail,
      },
    });

    // Create organisation invitation
    const invitation = await tx.organisationInvitation.create({
      data: {
        organisationName: application.companyName,
        tradingName: application.tradingName,
        companyRegistrationNo: application.companyRegistrationNo,
        contactEmail: application.primaryContactEmail,
        contactPhone: application.primaryContactPhone,
        registeredAddressLine1: application.registeredAddressLine1,
        registeredCity: application.registeredCity,
        registeredPostcode: application.registeredPostcode,
        primaryAdminName: application.primaryContactName,
        primaryAdminEmail: application.primaryContactEmail,
        tokenHash,
        expiresAt,
        invitedByUserId: context.userId,
        organisationId: organisation.id,
      },
    });

    // Create onboarding record
    await tx.organisationOnboarding.create({
      data: {
        organisationId: organisation.id,
        status: "INVITED",
        currentStep: 0,
      },
    });

    // Create organisation-level audit log
    await tx.auditLog.create({
      data: {
        organisationId: organisation.id,
        actorUserId: context.userId,
        action: "organisation.provisioned",
        entityType: "Organisation",
        entityId: organisation.id,
        metadata: {
          applicationId: application.id,
          provisionedBy: context.user.email,
        },
      },
    });

    return { organisation, invitation };
  });

  // Platform audit log
  await createPlatformAuditLog(context, "organisation.provisioned", {
    entityType: "Organisation",
    entityId: result.organisation.id,
    targetOrgId: result.organisation.id,
    metadata: {
      applicationId: application.id,
      organisationName: application.companyName,
      primaryAdminEmail: application.primaryContactEmail,
    },
  });

  // Send invitation email
  let emailSent = false;
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
    const acceptUrl = `${baseUrl}/organisation-invite/${token}`;

    await sendOrganisationInvitationEmail({
      to: application.primaryContactEmail,
      organisationName: application.companyName,
      adminName: application.primaryContactName,
      acceptUrl,
      expiresAt,
    });
    emailSent = true;
  } catch (error) {
    // Log but don't fail - email can be resent
    console.error("Failed to send organisation invitation email:", error);
  }

  return {
    organisationId: result.organisation.id,
    invitationId: result.invitation.id,
    invitationToken: token, // Returned for debugging/manual sending if email fails
    emailSent,
  };
}

/**
 * Provision an organisation directly (platform admin creates org without application).
 * Used for manual onboarding or migrating existing customers.
 */
export async function provisionOrganisationDirect(
  input: {
    organisationName: string;
    tradingName?: string;
    contactEmail: string;
    contactPhone?: string;
    primaryAdminName: string;
    primaryAdminEmail: string;
  },
  context: PlatformAdminContext
): Promise<ProvisioningResult> {
  // Check if admin email already exists
  const existingUser = await db.user.findUnique({
    where: { email: input.primaryAdminEmail.toLowerCase() },
  });

  if (existingUser) {
    throw new Error("A user with this email address already exists.");
  }

  // Check for pending invitation
  const existingInvitation = await db.organisationInvitation.findFirst({
    where: {
      primaryAdminEmail: input.primaryAdminEmail.toLowerCase(),
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (existingInvitation) {
    throw new Error("A pending invitation already exists for this administrator email.");
  }

  // Generate organisation slug
  const slug = await generateSlug(input.organisationName);

  // Generate invitation token
  const token = createSecretToken();
  const tokenHash = hashSecretToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

  // Create organisation and invitation in a transaction
  const result = await db.$transaction(async (tx) => {
    // Create organisation with PENDING status
    const organisation = await tx.organisation.create({
      data: {
        name: input.organisationName,
        slug,
        brandName: input.tradingName ?? input.organisationName,
        status: "PENDING",
        tradingName: input.tradingName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
      },
    });

    // Create Head Office branch
    await tx.branch.create({
      data: {
        organisationId: organisation.id,
        name: "Head Office",
        code: "HQ",
        status: "ACTIVE",
        isHeadOffice: true,
        email: input.contactEmail,
        phone: input.contactPhone,
      },
    });

    // Create organisation invitation
    const invitation = await tx.organisationInvitation.create({
      data: {
        organisationName: input.organisationName,
        tradingName: input.tradingName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        primaryAdminName: input.primaryAdminName,
        primaryAdminEmail: input.primaryAdminEmail.toLowerCase(),
        tokenHash,
        expiresAt,
        invitedByUserId: context.userId,
        organisationId: organisation.id,
      },
    });

    // Create onboarding record
    await tx.organisationOnboarding.create({
      data: {
        organisationId: organisation.id,
        status: "INVITED",
        currentStep: 0,
      },
    });

    return { organisation, invitation };
  });

  // Platform audit log
  await createPlatformAuditLog(context, "organisation.created_direct", {
    entityType: "Organisation",
    entityId: result.organisation.id,
    targetOrgId: result.organisation.id,
    metadata: {
      organisationName: input.organisationName,
      primaryAdminEmail: input.primaryAdminEmail,
    },
  });

  // Send invitation email
  let emailSent = false;
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
    const acceptUrl = `${baseUrl}/organisation-invite/${token}`;

    await sendOrganisationInvitationEmail({
      to: input.primaryAdminEmail,
      organisationName: input.organisationName,
      adminName: input.primaryAdminName,
      acceptUrl,
      expiresAt,
    });
    emailSent = true;
  } catch (error) {
    console.error("Failed to send organisation invitation email:", error);
  }

  return {
    organisationId: result.organisation.id,
    invitationId: result.invitation.id,
    invitationToken: token,
    emailSent,
  };
}
