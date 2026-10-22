-- =============================================================================
-- Phase 7: Pilot Feedback Schema
-- EnCare Production Readiness
-- =============================================================================

-- Feedback severity enum
CREATE TYPE "FeedbackSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'SUGGESTION');

-- Feedback status enum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX', 'DUPLICATE');

-- Feedback category enum
CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'USABILITY', 'PERFORMANCE', 'SECURITY', 'DATA', 'FEATURE', 'DOCUMENTATION', 'OTHER');

-- Pilot feedback table
CREATE TABLE "pilot_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organisationId" UUID,
    "submittedById" UUID NOT NULL,
    "submittedByRole" "Role" NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "severity" "FeedbackSeverity" NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "featureArea" TEXT NOT NULL,
    "workflow" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reproductionSteps" TEXT,
    "expectedBehavior" TEXT,
    "actualBehavior" TEXT,
    "browserInfo" TEXT,
    "screenResolution" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" UUID,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilot_feedback_pkey" PRIMARY KEY ("id")
);

-- Indexes for efficient querying
CREATE INDEX "pilot_feedback_organisationId_status_idx" ON "pilot_feedback"("organisationId", "status");
CREATE INDEX "pilot_feedback_status_severity_idx" ON "pilot_feedback"("status", "severity");
CREATE INDEX "pilot_feedback_category_status_idx" ON "pilot_feedback"("category", "status");
CREATE INDEX "pilot_feedback_submittedById_idx" ON "pilot_feedback"("submittedById");
CREATE INDEX "pilot_feedback_createdAt_idx" ON "pilot_feedback"("createdAt");

-- Foreign key constraints
ALTER TABLE "pilot_feedback" ADD CONSTRAINT "pilot_feedback_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pilot_feedback" ADD CONSTRAINT "pilot_feedback_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pilot_feedback" ADD CONSTRAINT "pilot_feedback_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
