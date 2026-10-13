-- Phase 3: Care Delivery Operations Migration
-- This migration adds care plans, tasks, task completions, and incident reporting

-- CreateEnum
CREATE TYPE "CarePlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskFrequency" AS ENUM ('EVERY_VISIT', 'DAILY', 'WEEKLY', 'MONTHLY', 'AS_NEEDED');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('FALL', 'MEDICATION_ERROR', 'SAFEGUARDING', 'BEHAVIOR', 'EQUIPMENT', 'MISSED_CARE', 'HEALTH_CONCERN', 'PROPERTY_DAMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "care_plans" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CarePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE NOT NULL,
    "reviewDate" DATE,
    "endDate" DATE,
    "specialInstructions" TEXT,
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plan_tasks" (
    "id" UUID NOT NULL,
    "carePlanId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "TaskFrequency" NOT NULL DEFAULT 'EVERY_VISIT',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_plan_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_task_completions" (
    "id" UUID NOT NULL,
    "visitId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "completedById" UUID NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "unableToComplete" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "reason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "incidentReference" TEXT NOT NULL,
    "clientId" UUID,
    "visitId" UUID,
    "reportedById" UUID NOT NULL,
    "reviewerId" UUID,
    "category" "IncidentCategory" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "immediateAction" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNotes" TEXT,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "care_plans_organisationId_clientId_idx" ON "care_plans"("organisationId", "clientId");

-- CreateIndex
CREATE INDEX "care_plans_organisationId_status_idx" ON "care_plans"("organisationId", "status");

-- CreateIndex
CREATE INDEX "care_plans_organisationId_reviewDate_idx" ON "care_plans"("organisationId", "reviewDate");

-- CreateIndex
CREATE INDEX "care_plan_tasks_carePlanId_isActive_idx" ON "care_plan_tasks"("carePlanId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "visit_task_completions_visitId_taskId_key" ON "visit_task_completions"("visitId", "taskId");

-- CreateIndex
CREATE INDEX "visit_task_completions_visitId_idx" ON "visit_task_completions"("visitId");

-- CreateIndex
CREATE INDEX "visit_task_completions_taskId_idx" ON "visit_task_completions"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_incidentReference_organisationId_key" ON "incidents"("incidentReference", "organisationId");

-- CreateIndex
CREATE INDEX "incidents_organisationId_status_idx" ON "incidents"("organisationId", "status");

-- CreateIndex
CREATE INDEX "incidents_organisationId_category_idx" ON "incidents"("organisationId", "category");

-- CreateIndex
CREATE INDEX "incidents_organisationId_clientId_idx" ON "incidents"("organisationId", "clientId");

-- CreateIndex
CREATE INDEX "incidents_organisationId_reportedById_idx" ON "incidents"("organisationId", "reportedById");

-- CreateIndex
CREATE INDEX "incidents_organisationId_reviewerId_idx" ON "incidents"("organisationId", "reviewerId");

-- CreateIndex
CREATE INDEX "incidents_organisationId_createdAt_idx" ON "incidents"("organisationId", "createdAt");

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_clientId_organisationId_fkey" FOREIGN KEY ("clientId", "organisationId") REFERENCES "clients"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plan_tasks" ADD CONSTRAINT "care_plan_tasks_carePlanId_fkey" FOREIGN KEY ("carePlanId") REFERENCES "care_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_task_completions" ADD CONSTRAINT "visit_task_completions_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "care_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_task_completions" ADD CONSTRAINT "visit_task_completions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "care_plan_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_task_completions" ADD CONSTRAINT "visit_task_completions_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_clientId_organisationId_fkey" FOREIGN KEY ("clientId", "organisationId") REFERENCES "clients"("id", "organisationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "care_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
