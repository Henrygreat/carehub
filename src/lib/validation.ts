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
