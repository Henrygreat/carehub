-- Phase 4: Scheduling and Workforce Management Migration
-- This migration adds staff availability, absences, notifications, and scheduling overrides

-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('ANNUAL_LEAVE', 'SICK_LEAVE', 'UNPAID_LEAVE', 'COMPASSIONATE', 'MATERNITY', 'PATERNITY', 'UNAVAILABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSIGNMENT_NEW', 'ASSIGNMENT_CHANGED', 'ASSIGNMENT_CANCELLED', 'VISIT_UPCOMING', 'VISIT_MISSED', 'VISIT_UNASSIGNED', 'LEAVE_REQUESTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'CONFLICT_DETECTED', 'GENERAL');

-- CreateEnum
CREATE TYPE "ConflictType" AS ENUM ('OVERLAP', 'DOUBLE_BOOKED', 'DURING_LEAVE', 'OUTSIDE_AVAILABILITY', 'INSUFFICIENT_TRAVEL_TIME', 'EXCEEDS_HOURS');

-- CreateTable: Staff Availability
CREATE TABLE "staff_availability" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "staffProfileId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Staff Absences
CREATE TABLE "staff_absences" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "staffProfileId" UUID NOT NULL,
    "type" "AbsenceType" NOT NULL,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startTime" TIME,
    "endTime" TIME,
    "isFullDay" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "notes" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_absences_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Notifications
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Scheduling Overrides
CREATE TABLE "scheduling_overrides" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "visitId" UUID,
    "shiftId" UUID,
    "staffProfileId" UUID NOT NULL,
    "conflictType" "ConflictType" NOT NULL,
    "conflictDetails" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedById" UUID NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduling_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Travel Time Estimates
CREATE TABLE "travel_time_estimates" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "fromPostcode" TEXT NOT NULL,
    "toPostcode" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_time_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Staff Availability
CREATE UNIQUE INDEX "staff_availability_staffProfileId_dayOfWeek_effectiveFrom_key" ON "staff_availability"("staffProfileId", "dayOfWeek", "effectiveFrom");
CREATE INDEX "staff_availability_organisationId_staffProfileId_idx" ON "staff_availability"("organisationId", "staffProfileId");
CREATE INDEX "staff_availability_staffProfileId_dayOfWeek_idx" ON "staff_availability"("staffProfileId", "dayOfWeek");

-- CreateIndex: Staff Absences
CREATE INDEX "staff_absences_organisationId_staffProfileId_idx" ON "staff_absences"("organisationId", "staffProfileId");
CREATE INDEX "staff_absences_organisationId_status_idx" ON "staff_absences"("organisationId", "status");
CREATE INDEX "staff_absences_organisationId_startDate_endDate_idx" ON "staff_absences"("organisationId", "startDate", "endDate");
CREATE INDEX "staff_absences_staffProfileId_startDate_endDate_idx" ON "staff_absences"("staffProfileId", "startDate", "endDate");

-- CreateIndex: Notifications
CREATE INDEX "notifications_organisationId_recipientId_isRead_idx" ON "notifications"("organisationId", "recipientId", "isRead");
CREATE INDEX "notifications_recipientId_createdAt_idx" ON "notifications"("recipientId", "createdAt");
CREATE INDEX "notifications_organisationId_createdAt_idx" ON "notifications"("organisationId", "createdAt");

-- CreateIndex: Scheduling Overrides
CREATE INDEX "scheduling_overrides_organisationId_visitId_idx" ON "scheduling_overrides"("organisationId", "visitId");
CREATE INDEX "scheduling_overrides_organisationId_shiftId_idx" ON "scheduling_overrides"("organisationId", "shiftId");
CREATE INDEX "scheduling_overrides_organisationId_staffProfileId_idx" ON "scheduling_overrides"("organisationId", "staffProfileId");

-- CreateIndex: Travel Time Estimates
CREATE UNIQUE INDEX "travel_time_estimates_organisationId_fromPostcode_toPostcode_key" ON "travel_time_estimates"("organisationId", "fromPostcode", "toPostcode");
CREATE INDEX "travel_time_estimates_organisationId_idx" ON "travel_time_estimates"("organisationId");

-- AddForeignKey: Staff Availability
ALTER TABLE "staff_availability" ADD CONSTRAINT "staff_availability_staffProfileId_organisationId_fkey" FOREIGN KEY ("staffProfileId", "organisationId") REFERENCES "staff_profiles"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Staff Absences
ALTER TABLE "staff_absences" ADD CONSTRAINT "staff_absences_staffProfileId_organisationId_fkey" FOREIGN KEY ("staffProfileId", "organisationId") REFERENCES "staff_profiles"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_absences" ADD CONSTRAINT "staff_absences_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Notifications
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Scheduling Overrides
ALTER TABLE "scheduling_overrides" ADD CONSTRAINT "scheduling_overrides_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "care_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduling_overrides" ADD CONSTRAINT "scheduling_overrides_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduling_overrides" ADD CONSTRAINT "scheduling_overrides_staffProfileId_organisationId_fkey" FOREIGN KEY ("staffProfileId", "organisationId") REFERENCES "staff_profiles"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduling_overrides" ADD CONSTRAINT "scheduling_overrides_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Travel Time Estimates
ALTER TABLE "travel_time_estimates" ADD CONSTRAINT "travel_time_estimates_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
