-- Phase 5: Multi-Organisation and Multi-Branch Management Migration
-- This migration adds platform admin functionality, organisation management, and branch support
-- SAFE: All changes preserve existing data with safe defaults

-- =============================================================================
-- Step 1: Create new enums
-- =============================================================================

-- CreateEnum: Organisation Status
CREATE TYPE "OrganisationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum: Branch Status
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- =============================================================================
-- Step 2: Alter existing tables with safe defaults
-- =============================================================================

-- AlterTable: users - Add platform admin flag (safe default: false)
ALTER TABLE "users" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: organisations - Add extended fields with safe defaults
ALTER TABLE "organisations" ADD COLUMN "status" "OrganisationStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "organisations" ADD COLUMN "tradingName" TEXT;
ALTER TABLE "organisations" ADD COLUMN "companyRegistrationNo" TEXT;
ALTER TABLE "organisations" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "organisations" ADD COLUMN "contactPhone" TEXT;

-- Registered address fields
ALTER TABLE "organisations" ADD COLUMN "registeredAddressLine1" TEXT;
ALTER TABLE "organisations" ADD COLUMN "registeredAddressLine2" TEXT;
ALTER TABLE "organisations" ADD COLUMN "registeredCity" TEXT;
ALTER TABLE "organisations" ADD COLUMN "registeredPostcode" TEXT;
ALTER TABLE "organisations" ADD COLUMN "registeredCountry" TEXT DEFAULT 'United Kingdom';

-- Operating address fields
ALTER TABLE "organisations" ADD COLUMN "operatingAddressLine1" TEXT;
ALTER TABLE "organisations" ADD COLUMN "operatingAddressLine2" TEXT;
ALTER TABLE "organisations" ADD COLUMN "operatingCity" TEXT;
ALTER TABLE "organisations" ADD COLUMN "operatingPostcode" TEXT;
ALTER TABLE "organisations" ADD COLUMN "operatingCountry" TEXT DEFAULT 'United Kingdom';

-- CQC regulatory fields
ALTER TABLE "organisations" ADD COLUMN "cqcProviderId" TEXT;
ALTER TABLE "organisations" ADD COLUMN "cqcProviderName" TEXT;
ALTER TABLE "organisations" ADD COLUMN "cqcRegisteredManager" TEXT;

-- Operational settings
ALTER TABLE "organisations" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/London';
ALTER TABLE "organisations" ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- =============================================================================
-- Step 3: Create new tables
-- =============================================================================

-- CreateTable: branches
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "serviceArea" TEXT,
    "cqcLocationId" TEXT,
    "isHeadOffice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable: branch_assignments
CREATE TABLE "branch_assignments" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "staffProfileId" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: organisation_invitations
CREATE TABLE "organisation_invitations" (
    "id" UUID NOT NULL,
    "organisationName" TEXT NOT NULL,
    "tradingName" TEXT,
    "companyRegistrationNo" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "registeredAddressLine1" TEXT,
    "registeredCity" TEXT,
    "registeredPostcode" TEXT,
    "primaryAdminName" TEXT NOT NULL,
    "primaryAdminEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "organisationId" UUID,
    "invitedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: platform_audit_logs
CREATE TABLE "platform_audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "targetOrgId" UUID,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- Step 4: Create indexes
-- =============================================================================

-- Indexes: branches
CREATE UNIQUE INDEX "branches_organisationId_code_key" ON "branches"("organisationId", "code");
CREATE INDEX "branches_organisationId_status_idx" ON "branches"("organisationId", "status");

-- Indexes: branch_assignments
CREATE UNIQUE INDEX "branch_assignments_branchId_staffProfileId_key" ON "branch_assignments"("branchId", "staffProfileId");
CREATE INDEX "branch_assignments_organisationId_staffProfileId_idx" ON "branch_assignments"("organisationId", "staffProfileId");
CREATE INDEX "branch_assignments_branchId_idx" ON "branch_assignments"("branchId");

-- Indexes: organisation_invitations
CREATE UNIQUE INDEX "organisation_invitations_tokenHash_key" ON "organisation_invitations"("tokenHash");
CREATE INDEX "organisation_invitations_contactEmail_idx" ON "organisation_invitations"("contactEmail");
CREATE INDEX "organisation_invitations_primaryAdminEmail_idx" ON "organisation_invitations"("primaryAdminEmail");
CREATE INDEX "organisation_invitations_expiresAt_idx" ON "organisation_invitations"("expiresAt");

-- Indexes: platform_audit_logs
CREATE INDEX "platform_audit_logs_actorUserId_createdAt_idx" ON "platform_audit_logs"("actorUserId", "createdAt");
CREATE INDEX "platform_audit_logs_targetOrgId_createdAt_idx" ON "platform_audit_logs"("targetOrgId", "createdAt");
CREATE INDEX "platform_audit_logs_action_createdAt_idx" ON "platform_audit_logs"("action", "createdAt");

-- =============================================================================
-- Step 5: Add foreign keys
-- =============================================================================

-- ForeignKey: branches -> organisations
ALTER TABLE "branches" ADD CONSTRAINT "branches_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ForeignKey: branch_assignments -> branches
ALTER TABLE "branch_assignments" ADD CONSTRAINT "branch_assignments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ForeignKey: branch_assignments -> staff_profiles (composite key)
ALTER TABLE "branch_assignments" ADD CONSTRAINT "branch_assignments_staffProfileId_organisationId_fkey" FOREIGN KEY ("staffProfileId", "organisationId") REFERENCES "staff_profiles"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- ForeignKey: organisation_invitations -> organisations
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ForeignKey: organisation_invitations -> users
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ForeignKey: platform_audit_logs -> users
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- Step 6: Idempotent backfill - Create default "Head Office" branch for existing organisations
-- =============================================================================

-- This creates a default Head Office branch for any organisation that doesn't have one
-- Uses INSERT ... ON CONFLICT DO NOTHING for idempotency (safe to run multiple times)
INSERT INTO "branches" ("id", "organisationId", "name", "code", "status", "isHeadOffice", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    o."id",
    'Head Office',
    'HQ',
    'ACTIVE'::"BranchStatus",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organisations" o
WHERE NOT EXISTS (
    SELECT 1 FROM "branches" b WHERE b."organisationId" = o."id"
);
