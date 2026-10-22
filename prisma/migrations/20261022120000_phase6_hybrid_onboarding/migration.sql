-- Phase 6: Hybrid Organisation Onboarding
-- This migration adds support for:
-- 1. Public organisation applications
-- 2. Platform admin approval workflow
-- 3. Organisation onboarding progress tracking

-- =============================================================================
-- CREATE ENUMS
-- =============================================================================

-- ApplicationStatus: Workflow states for organisation applications
CREATE TYPE "ApplicationStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN'
);

-- OnboardingStatus: Workflow states for organisation onboarding
CREATE TYPE "OnboardingStatus" AS ENUM (
  'INVITED',
  'IN_PROGRESS',
  'READY_FOR_ACTIVATION',
  'ACTIVE',
  'BLOCKED'
);

-- =============================================================================
-- CREATE TABLES
-- =============================================================================

-- Organisation Applications Table
-- Stores public applications from care companies wanting to join the platform
CREATE TABLE "organisation_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  -- Company details
  "companyName" TEXT NOT NULL,
  "tradingName" TEXT,
  "companyRegistrationNo" TEXT,
  "registeredAddressLine1" TEXT,
  "registeredAddressLine2" TEXT,
  "registeredCity" TEXT,
  "registeredPostcode" TEXT,
  -- Primary contact
  "primaryContactName" TEXT NOT NULL,
  "primaryContactEmail" TEXT NOT NULL,
  "primaryContactPhone" TEXT,
  -- Care services
  "careServiceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "cqcRegistrationNo" TEXT,
  "estimatedStaffCount" INTEGER,
  "estimatedBranchCount" INTEGER,
  -- Application status workflow
  "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  -- Review
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" UUID,
  "reviewNotes" TEXT,
  "rejectionReason" TEXT,
  -- Provisioning (links to created organisation after approval)
  "organisationId" UUID,
  "invitationId" UUID,
  -- Consent
  "privacyNoticeAccepted" BOOLEAN NOT NULL DEFAULT false,
  "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
  -- Timestamps
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organisation_applications_pkey" PRIMARY KEY ("id")
);

-- Organisation Onboarding Table
-- Tracks the onboarding progress for each organisation
CREATE TABLE "organisation_onboarding" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organisationId" UUID NOT NULL,
  "status" "OnboardingStatus" NOT NULL DEFAULT 'INVITED',
  "currentStep" INTEGER NOT NULL DEFAULT 0,
  "completedSteps" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  -- Step completion flags
  "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
  "branchesCompleted" BOOLEAN NOT NULL DEFAULT false,
  "servicesCompleted" BOOLEAN NOT NULL DEFAULT false,
  "teamCompleted" BOOLEAN NOT NULL DEFAULT false,
  "reviewCompleted" BOOLEAN NOT NULL DEFAULT false,
  -- Timestamps
  "lastStepAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organisation_onboarding_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- CREATE INDEXES
-- =============================================================================

-- Application indexes for common queries
CREATE INDEX "organisation_applications_status_submittedAt_idx"
  ON "organisation_applications"("status", "submittedAt");
CREATE INDEX "organisation_applications_primaryContactEmail_idx"
  ON "organisation_applications"("primaryContactEmail");

-- Onboarding unique constraint (one onboarding record per organisation)
CREATE UNIQUE INDEX "organisation_onboarding_organisationId_key"
  ON "organisation_onboarding"("organisationId");

-- =============================================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Application -> User (reviewer) - SET NULL on delete
ALTER TABLE "organisation_applications"
  ADD CONSTRAINT "organisation_applications_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Application -> Organisation - SET NULL on delete
ALTER TABLE "organisation_applications"
  ADD CONSTRAINT "organisation_applications_organisationId_fkey"
  FOREIGN KEY ("organisationId")
  REFERENCES "organisations"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Onboarding -> Organisation - CASCADE on delete
ALTER TABLE "organisation_onboarding"
  ADD CONSTRAINT "organisation_onboarding_organisationId_fkey"
  FOREIGN KEY ("organisationId")
  REFERENCES "organisations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
