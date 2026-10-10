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
