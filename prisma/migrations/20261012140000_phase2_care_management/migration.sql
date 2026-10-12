-- Phase 2: Care Management Migration
-- This migration adds client management, care visits, and shift scheduling

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "clientReference" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "preferredName" TEXT,
    "dateOfBirth" DATE,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "careNotes" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_visits" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "staffProfileId" UUID,
    "recurrenceId" UUID,
    "scheduledDate" DATE NOT NULL,
    "scheduledStart" TIME NOT NULL,
    "scheduledEnd" TIME NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "status" "VisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "visitType" TEXT,
    "notes" TEXT,
    "cancellationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_recurrences" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "staffProfileId" UUID,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "daysOfWeek" INTEGER[],
    "scheduledStart" TIME NOT NULL,
    "scheduledEnd" TIME NOT NULL,
    "visitType" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "shiftReference" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "locationAddress" TEXT,
    "scheduledDate" DATE NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "cancellationNote" TEXT,
    "isOvernight" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_recurrences" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "locationName" TEXT NOT NULL,
    "locationAddress" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "daysOfWeek" INTEGER[],
    "scheduledStart" TIME NOT NULL,
    "scheduledEnd" TIME NOT NULL,
    "isOvernight" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "staffProfileId" UUID NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "status" "VisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_notes" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "visitId" UUID,
    "shiftId" UUID,
    "clientId" UUID,
    "authorMembershipId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "isIncident" BOOLEAN NOT NULL DEFAULT false,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_clientReference_organisationId_key" ON "clients"("clientReference", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_id_organisationId_key" ON "clients"("id", "organisationId");

-- CreateIndex
CREATE INDEX "clients_organisationId_status_idx" ON "clients"("organisationId", "status");

-- CreateIndex
CREATE INDEX "clients_organisationId_lastName_firstName_idx" ON "clients"("organisationId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "emergency_contacts_clientId_idx" ON "emergency_contacts"("clientId");

-- CreateIndex
CREATE INDEX "care_visits_organisationId_scheduledDate_idx" ON "care_visits"("organisationId", "scheduledDate");

-- CreateIndex
CREATE INDEX "care_visits_organisationId_clientId_idx" ON "care_visits"("organisationId", "clientId");

-- CreateIndex
CREATE INDEX "care_visits_organisationId_staffProfileId_idx" ON "care_visits"("organisationId", "staffProfileId");

-- CreateIndex
CREATE INDEX "care_visits_organisationId_status_idx" ON "care_visits"("organisationId", "status");

-- CreateIndex
CREATE INDEX "care_visits_recurrenceId_idx" ON "care_visits"("recurrenceId");

-- CreateIndex
CREATE INDEX "visit_recurrences_organisationId_isActive_idx" ON "visit_recurrences"("organisationId", "isActive");

-- CreateIndex
CREATE INDEX "visit_recurrences_organisationId_clientId_idx" ON "visit_recurrences"("organisationId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_shiftReference_organisationId_key" ON "shifts"("shiftReference", "organisationId");

-- CreateIndex
CREATE INDEX "shifts_organisationId_scheduledDate_idx" ON "shifts"("organisationId", "scheduledDate");

-- CreateIndex
CREATE INDEX "shifts_organisationId_status_idx" ON "shifts"("organisationId", "status");

-- CreateIndex
CREATE INDEX "shifts_recurrenceId_idx" ON "shifts"("recurrenceId");

-- CreateIndex
CREATE INDEX "shift_recurrences_organisationId_isActive_idx" ON "shift_recurrences"("organisationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_shiftId_staffProfileId_key" ON "shift_assignments"("shiftId", "staffProfileId");

-- CreateIndex
CREATE INDEX "shift_assignments_organisationId_staffProfileId_idx" ON "shift_assignments"("organisationId", "staffProfileId");

-- CreateIndex
CREATE INDEX "shift_assignments_shiftId_idx" ON "shift_assignments"("shiftId");

-- CreateIndex
CREATE INDEX "care_notes_organisationId_visitId_idx" ON "care_notes"("organisationId", "visitId");

-- CreateIndex
CREATE INDEX "care_notes_organisationId_shiftId_idx" ON "care_notes"("organisationId", "shiftId");

-- CreateIndex
CREATE INDEX "care_notes_organisationId_clientId_idx" ON "care_notes"("organisationId", "clientId");

-- CreateIndex
CREATE INDEX "care_notes_organisationId_isIncident_idx" ON "care_notes"("organisationId", "isIncident");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_visits" ADD CONSTRAINT "care_visits_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_visits" ADD CONSTRAINT "care_visits_clientId_organisationId_fkey" FOREIGN KEY ("clientId", "organisationId") REFERENCES "clients"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_visits" ADD CONSTRAINT "care_visits_staffProfileId_organisationId_fkey" FOREIGN KEY ("staffProfileId", "organisationId") REFERENCES "staff_profiles"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_visits" ADD CONSTRAINT "care_visits_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "visit_recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "shift_recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_staffProfileId_organisationId_fkey" FOREIGN KEY ("staffProfileId", "organisationId") REFERENCES "staff_profiles"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_notes" ADD CONSTRAINT "care_notes_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_notes" ADD CONSTRAINT "care_notes_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "care_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_notes" ADD CONSTRAINT "care_notes_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_notes" ADD CONSTRAINT "care_notes_clientId_organisationId_fkey" FOREIGN KEY ("clientId", "organisationId") REFERENCES "clients"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_notes" ADD CONSTRAINT "care_notes_authorMembershipId_organisationId_fkey" FOREIGN KEY ("authorMembershipId", "organisationId") REFERENCES "memberships"("id", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;
