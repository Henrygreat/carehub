import { z } from "zod";

const hours = z.coerce.number().min(0).max(168);

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const staffSchema = z.object({
  employeeNumber: z.string().trim().min(1).max(32),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  phone: z.string().trim().max(32).nullable().optional(),
  employmentStatus: z.enum(["ACTIVE", "ON_LEAVE", "INACTIVE"]),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "ZERO_HOURS", "CONTRACTOR", "TEMPORARY"]),
  jobTitle: z.string().trim().min(1).max(100),
  startDate: z.coerce.date(),
  contractedWeeklyHours: hours,
});

export const personalContactSchema = z.object({
  phone: z.string().trim().max(32).nullable().optional(),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});

export const organisationSchema = z.object({
  name: z.string().trim().min(2).max(120).regex(/^[^\r\n]+$/),
  brandName: z.string().trim().max(120).nullable().optional(),
  brandColour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const invitationSchema = z.object({
  email: z.string().email().max(254).transform((email) => email.toLowerCase()),
  role: z.enum(["ORG_ADMIN", "MANAGER", "COORDINATOR", "CARE_WORKER"]),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(32).max(128),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email().max(254).transform((email) => email.toLowerCase()),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(12).max(128),
});

// =============================================================================
// Phase 2: Client Management Schemas
// =============================================================================

export const clientSchema = z.object({
  clientReference: z.string().trim().min(1).max(32),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  preferredName: z.string().trim().max(80).nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  addressLine1: z.string().trim().max(200).nullable().optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  postcode: z.string().trim().max(20).nullable().optional(),
  careNotes: z.string().max(5000).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(60),
  phone: z.string().trim().min(1).max(32),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()).nullable().optional(),
  isPrimary: z.boolean().default(false),
});

// =============================================================================
// Phase 2: Care Visit Schemas
// =============================================================================

// Time string validation (HH:MM format)
const timeString = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format");

export const careVisitSchema = z.object({
  clientId: z.string().uuid(),
  staffProfileId: z.string().uuid().nullable().optional(),
  scheduledDate: z.coerce.date(),
  scheduledStart: timeString,
  scheduledEnd: timeString,
  visitType: z.string().trim().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const visitRecurrenceSchema = z.object({
  clientId: z.string().uuid(),
  staffProfileId: z.string().uuid().nullable().optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]),
  daysOfWeek: z.array(z.number().min(0).max(6)), // 0 = Sunday, 6 = Saturday
  scheduledStart: timeString,
  scheduledEnd: timeString,
  visitType: z.string().trim().max(100).nullable().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
});

export const visitCancellationSchema = z.object({
  cancellationNote: z.string().trim().min(1).max(500),
});

// =============================================================================
// Phase 2: Shift Schemas
// =============================================================================

export const shiftSchema = z.object({
  shiftReference: z.string().trim().min(1).max(32),
  locationName: z.string().trim().min(1).max(200),
  locationAddress: z.string().trim().max(500).nullable().optional(),
  scheduledDate: z.coerce.date(),
  scheduledStart: z.string(), // ISO datetime for shifts that cross midnight
  scheduledEnd: z.string(),
  notes: z.string().max(2000).nullable().optional(),
  isOvernight: z.boolean().default(false),
  staffProfileIds: z.array(z.string().uuid()).optional(),
});

export const shiftRecurrenceSchema = z.object({
  locationName: z.string().trim().min(1).max(200),
  locationAddress: z.string().trim().max(500).nullable().optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]),
  daysOfWeek: z.array(z.number().min(0).max(6)),
  scheduledStart: timeString,
  scheduledEnd: timeString,
  isOvernight: z.boolean().default(false),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  staffProfileIds: z.array(z.string().uuid()).optional(),
});

export const shiftAssignmentSchema = z.object({
  staffProfileId: z.string().uuid(),
});

export const shiftCancellationSchema = z.object({
  cancellationNote: z.string().trim().min(1).max(500),
});

// =============================================================================
// Phase 2: Attendance Schemas
// =============================================================================

export const attendanceStartSchema = z.object({
  actualStart: z.coerce.date().optional(), // If not provided, use current time
});

export const attendanceCompleteSchema = z.object({
  actualEnd: z.coerce.date().optional(), // If not provided, use current time
  notes: z.string().max(2000).nullable().optional(),
});

export const careNoteSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  isIncident: z.boolean().default(false),
  isPrivate: z.boolean().default(false),
});

// =============================================================================
// Phase 3: Care Plan Schemas
// =============================================================================

export const carePlanSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "UNDER_REVIEW", "ARCHIVED"]).default("DRAFT"),
  startDate: z.coerce.date(),
  reviewDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  specialInstructions: z.string().max(5000).nullable().optional(),
  isConfidential: z.boolean().default(false),
});

export const carePlanTaskSchema = z.object({
  carePlanId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  frequency: z.enum(["EVERY_VISIT", "DAILY", "WEEKLY", "MONTHLY", "AS_NEEDED"]).default("EVERY_VISIT"),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

// Batch create tasks with a care plan
export const carePlanWithTasksSchema = carePlanSchema.extend({
  tasks: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
    frequency: z.enum(["EVERY_VISIT", "DAILY", "WEEKLY", "MONTHLY", "AS_NEEDED"]).default("EVERY_VISIT"),
    isRequired: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })).optional(),
});

// =============================================================================
// Phase 3: Task Completion Schemas
// =============================================================================

export const taskCompletionSchema = z.object({
  taskId: z.string().uuid(),
  completed: z.boolean().default(false),
  unableToComplete: z.boolean().default(false),
  notes: z.string().max(1000).nullable().optional(),
  reason: z.string().max(500).nullable().optional(), // Reason for unable to complete
});

// Batch complete multiple tasks for a visit
export const batchTaskCompletionSchema = z.object({
  completions: z.array(taskCompletionSchema),
});

// =============================================================================
// Phase 3: Incident Schemas
// =============================================================================

export const incidentSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  visitId: z.string().uuid().nullable().optional(),
  category: z.enum([
    "FALL",
    "MEDICATION_ERROR",
    "SAFEGUARDING",
    "BEHAVIOR",
    "EQUIPMENT",
    "MISSED_CARE",
    "HEALTH_CONCERN",
    "PROPERTY_DAMAGE",
    "OTHER",
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  occurredAt: z.coerce.date(),
  location: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().min(10).max(5000),
  immediateAction: z.string().max(2000).nullable().optional(),
  followUpRequired: z.boolean().default(false),
});

export const incidentReviewSchema = z.object({
  status: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"]),
  followUpNotes: z.string().max(5000).nullable().optional(),
  resolutionNotes: z.string().max(5000).nullable().optional(),
});

export const incidentUpdateSchema = z.object({
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  immediateAction: z.string().max(2000).nullable().optional(),
  followUpRequired: z.boolean().optional(),
  followUpNotes: z.string().max(5000).nullable().optional(),
});

// =============================================================================
// Phase 4: Scheduling and Workforce Management Schemas
// =============================================================================

// Time string validation (HH:MM format)
const timeStringPhase4 = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format");

export const staffAvailabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6), // 0=Sunday, 6=Saturday
  startTime: timeStringPhase4,
  endTime: timeStringPhase4,
  isPreferred: z.boolean().default(false),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
});

export const staffAvailabilityBatchSchema = z.object({
  availability: z.array(staffAvailabilitySchema),
});

export const staffAbsenceSchema = z.object({
  type: z.enum([
    "ANNUAL_LEAVE",
    "SICK_LEAVE",
    "UNPAID_LEAVE",
    "COMPASSIONATE",
    "MATERNITY",
    "PATERNITY",
    "UNAVAILABLE",
    "OTHER",
  ]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  startTime: timeStringPhase4.nullable().optional(),
  endTime: timeStringPhase4.nullable().optional(),
  isFullDay: z.boolean().default(true),
  reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const absenceReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().max(1000).nullable().optional(),
});

export const schedulingOverrideSchema = z.object({
  visitId: z.string().uuid().nullable().optional(),
  shiftId: z.string().uuid().nullable().optional(),
  staffProfileId: z.string().uuid(),
  conflictType: z.enum([
    "OVERLAP",
    "DOUBLE_BOOKED",
    "DURING_LEAVE",
    "OUTSIDE_AVAILABILITY",
    "INSUFFICIENT_TRAVEL_TIME",
    "EXCEEDS_HOURS",
  ]),
  conflictDetails: z.object({}).passthrough(),
  reason: z.string().trim().min(5).max(500),
});

export const travelTimeEstimateSchema = z.object({
  fromPostcode: z.string().trim().min(2).max(10),
  toPostcode: z.string().trim().min(2).max(10),
  estimatedMinutes: z.number().int().min(1).max(480),
  notes: z.string().max(500).nullable().optional(),
});

// Calendar/rota query parameters
export const rotaQuerySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  staffProfileId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "MISSED", "CANCELLED"]).optional(),
  unassignedOnly: z.coerce.boolean().optional(),
});

// Drag-drop reschedule
export const visitRescheduleSchema = z.object({
  scheduledDate: z.coerce.date(),
  scheduledStart: timeStringPhase4,
  scheduledEnd: timeStringPhase4,
  staffProfileId: z.string().uuid().nullable().optional(),
  overrideConflicts: z.boolean().default(false),
  overrideReason: z.string().max(500).optional(),
});

// Notification mark as read
export const notificationReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()),
});

// =============================================================================
// Phase 5: Multi-Organisation and Multi-Branch Schemas
// =============================================================================

// Extended organisation schema (for platform admin updates)
export const organisationExtendedSchema = z.object({
  name: z.string().trim().min(2).max(120).regex(/^[^\r\n]+$/),
  brandName: z.string().trim().max(120).nullable().optional(),
  brandColour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  tradingName: z.string().trim().max(120).nullable().optional(),
  companyRegistrationNo: z.string().trim().max(20).nullable().optional(),
  contactEmail: z.string().email().max(254).nullable().optional(),
  contactPhone: z.string().trim().max(32).nullable().optional(),
  registeredAddressLine1: z.string().trim().max(200).nullable().optional(),
  registeredAddressLine2: z.string().trim().max(200).nullable().optional(),
  registeredCity: z.string().trim().max(100).nullable().optional(),
  registeredPostcode: z.string().trim().max(20).nullable().optional(),
  registeredCountry: z.string().trim().max(100).nullable().optional(),
  operatingAddressLine1: z.string().trim().max(200).nullable().optional(),
  operatingAddressLine2: z.string().trim().max(200).nullable().optional(),
  operatingCity: z.string().trim().max(100).nullable().optional(),
  operatingPostcode: z.string().trim().max(20).nullable().optional(),
  operatingCountry: z.string().trim().max(100).nullable().optional(),
  cqcProviderId: z.string().trim().max(32).nullable().optional(),
  cqcProviderName: z.string().trim().max(200).nullable().optional(),
  cqcRegisteredManager: z.string().trim().max(120).nullable().optional(),
  timezone: z.string().trim().max(64).default("Europe/London"),
});

// Organisation invitation schema (platform admin inviting new organisation)
export const organisationInvitationSchema = z.object({
  organisationName: z.string().trim().min(2).max(120),
  tradingName: z.string().trim().max(120).nullable().optional(),
  companyRegistrationNo: z.string().trim().max(20).nullable().optional(),
  contactEmail: z.string().email().max(254),
  contactPhone: z.string().trim().max(32).nullable().optional(),
  registeredAddressLine1: z.string().trim().max(200).nullable().optional(),
  registeredCity: z.string().trim().max(100).nullable().optional(),
  registeredPostcode: z.string().trim().max(20).nullable().optional(),
  primaryAdminName: z.string().trim().min(2).max(120),
  primaryAdminEmail: z.string().email().max(254),
});

// Accept organisation invitation schema
export const acceptOrganisationInvitationSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(12).max(128),
});

// Branch schema
export const branchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(20).regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, numbers, and hyphens only"),
  addressLine1: z.string().trim().max(200).nullable().optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  postcode: z.string().trim().max(20).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  email: z.string().email().max(254).nullable().optional(),
  serviceArea: z.string().trim().max(200).nullable().optional(),
  cqcLocationId: z.string().trim().max(32).nullable().optional(),
  isHeadOffice: z.boolean().default(false),
});

// Branch update schema (code cannot be changed after creation)
export const branchUpdateSchema = branchSchema.omit({ code: true });

// Branch assignment schema
export const branchAssignmentSchema = z.object({
  staffProfileId: z.string().uuid(),
  isPrimary: z.boolean().default(false),
  role: z.string().trim().max(100).nullable().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
});

// Batch branch assignment schema
export const batchBranchAssignmentSchema = z.object({
  assignments: z.array(branchAssignmentSchema),
});

// =============================================================================
// Phase 6: Hybrid Onboarding Schemas
// =============================================================================

// Care service types for UK domiciliary care
export const careServiceTypes = [
  "Personal care",
  "Medication support",
  "Companionship",
  "Domestic support",
  "Live-in care",
  "Complex care",
  "Dementia care",
  "End of life care",
  "Learning disability support",
  "Mental health support",
  "Physical disability support",
  "Reablement",
  "Respite care",
] as const;

// Public organisation application schema
export const organisationApplicationSchema = z.object({
  // Company details
  companyName: z.string().trim().min(2).max(200),
  tradingName: z.string().trim().max(200).nullable().optional(),
  companyRegistrationNo: z.string().trim().max(20).nullable().optional(),
  registeredAddressLine1: z.string().trim().max(200).nullable().optional(),
  registeredAddressLine2: z.string().trim().max(200).nullable().optional(),
  registeredCity: z.string().trim().max(100).nullable().optional(),
  registeredPostcode: z.string().trim().max(20).nullable().optional(),
  // Primary contact
  primaryContactName: z.string().trim().min(2).max(120),
  primaryContactEmail: z.string().email().max(254).transform((e) => e.toLowerCase()),
  primaryContactPhone: z.string().trim().max(32).nullable().optional(),
  // Care services
  careServiceTypes: z.array(z.string().max(100)).min(1).max(15),
  cqcRegistrationNo: z.string().trim().max(32).nullable().optional(),
  estimatedStaffCount: z.coerce.number().int().min(1).max(10000).nullable().optional(),
  estimatedBranchCount: z.coerce.number().int().min(1).max(500).nullable().optional(),
  // Consent (required for submission)
  privacyNoticeAccepted: z.boolean(),
  termsAccepted: z.boolean(),
});

// Application submission schema (consent required)
export const submitApplicationSchema = organisationApplicationSchema.refine(
  (data) => data.privacyNoticeAccepted && data.termsAccepted,
  { message: "You must accept the privacy notice and terms to submit your application." }
);

// Platform admin application review schema
export const applicationReviewSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
  reviewNotes: z.string().max(2000).nullable().optional(),
  rejectionReason: z.string().max(1000).nullable().optional(),
});

// Onboarding progress update schema
export const onboardingProgressSchema = z.object({
  currentStep: z.number().int().min(0).max(4),
  profileCompleted: z.boolean().optional(),
  branchesCompleted: z.boolean().optional(),
  servicesCompleted: z.boolean().optional(),
  teamCompleted: z.boolean().optional(),
  reviewCompleted: z.boolean().optional(),
});

// Organisation profile update schema (onboarding step 1)
export const onboardingProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  tradingName: z.string().trim().max(120).nullable().optional(),
  companyRegistrationNo: z.string().trim().max(20).nullable().optional(),
  contactEmail: z.string().email().max(254).nullable().optional(),
  contactPhone: z.string().trim().max(32).nullable().optional(),
  registeredAddressLine1: z.string().trim().max(200).nullable().optional(),
  registeredAddressLine2: z.string().trim().max(200).nullable().optional(),
  registeredCity: z.string().trim().max(100).nullable().optional(),
  registeredPostcode: z.string().trim().max(20).nullable().optional(),
  cqcProviderId: z.string().trim().max(32).nullable().optional(),
  cqcProviderName: z.string().trim().max(200).nullable().optional(),
  cqcRegisteredManager: z.string().trim().max(120).nullable().optional(),
});

// =============================================================================
// Phase 7: Pilot Feedback Schemas
// =============================================================================

// Feedback categories
export const feedbackCategories = [
  "BUG",
  "USABILITY",
  "PERFORMANCE",
  "SECURITY",
  "DATA",
  "FEATURE",
  "DOCUMENTATION",
  "OTHER",
] as const;

// Feedback severity levels
export const feedbackSeverities = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "SUGGESTION",
] as const;

// Feedback statuses
export const feedbackStatuses = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "RESOLVED",
  "WONT_FIX",
  "DUPLICATE",
] as const;

// Feature areas for categorisation
export const featureAreas = [
  "Authentication",
  "Dashboard",
  "Staff Management",
  "Client Management",
  "Care Plans",
  "Visits",
  "Shifts",
  "Rota/Scheduling",
  "Incidents",
  "Availability/Absences",
  "Branches",
  "Organisation Settings",
  "Onboarding",
  "Platform Admin",
  "Notifications",
  "Reporting",
  "Other",
] as const;

// Create feedback schema (user submission)
export const pilotFeedbackSchema = z.object({
  category: z.enum(feedbackCategories),
  severity: z.enum(feedbackSeverities),
  featureArea: z.string().min(1).max(100),
  workflow: z.string().max(200).nullable().optional(),
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(20).max(5000),
  reproductionSteps: z.string().max(3000).nullable().optional(),
  expectedBehavior: z.string().max(1000).nullable().optional(),
  actualBehavior: z.string().max(1000).nullable().optional(),
  browserInfo: z.string().max(500).nullable().optional(),
  screenResolution: z.string().max(50).nullable().optional(),
  relatedEntityType: z.string().max(50).nullable().optional(),
  relatedEntityId: z.string().uuid().nullable().optional(),
});

// Update feedback schema (admin updating status/resolution)
export const pilotFeedbackUpdateSchema = z.object({
  status: z.enum(feedbackStatuses).optional(),
  severity: z.enum(feedbackSeverities).optional(),
  resolution: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
});

// Query feedback schema (filter parameters)
export const pilotFeedbackQuerySchema = z.object({
  status: z.enum(feedbackStatuses).optional(),
  severity: z.enum(feedbackSeverities).optional(),
  category: z.enum(feedbackCategories).optional(),
  featureArea: z.string().optional(),
  organisationId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
