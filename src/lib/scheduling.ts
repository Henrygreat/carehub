import { db } from "@/lib/db";
import type { ConflictType } from "@prisma/client";

export type SchedulingConflict = {
  type: ConflictType;
  severity: "warning" | "error";
  message: string;
  details: Record<string, unknown>;
};

export type TimeSlot = {
  date: Date;
  startTime: Date; // Time portion only
  endTime: Date;   // Time portion only
};

// Convert time string (HH:MM) to Date with time only
export function parseTimeString(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date(1970, 0, 1, hours, minutes, 0, 0);
  return date;
}

// Format time from Date to HH:MM string
export function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

// Check if two time ranges overlap
export function timesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): boolean {
  const s1 = start1.getTime();
  const e1 = end1.getTime();
  const s2 = start2.getTime();
  const e2 = end2.getTime();
  return s1 < e2 && s2 < e1;
}

// Calculate minutes between two times
export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

// Get day of week from date (0 = Sunday, 6 = Saturday)
export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

// Check scheduling conflicts for a staff member
export async function checkSchedulingConflicts(
  organisationId: string,
  staffProfileId: string,
  date: Date,
  startTime: Date,
  endTime: Date,
  excludeVisitId?: string,
  excludeShiftId?: string,
): Promise<SchedulingConflict[]> {
  const conflicts: SchedulingConflict[] = [];
  const dayOfWeek = getDayOfWeek(date);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // 1. Check for overlapping visits
  const overlappingVisits = await db.careVisit.findMany({
    where: {
      organisationId,
      staffProfileId,
      scheduledDate: dateOnly,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      ...(excludeVisitId && { id: { not: excludeVisitId } }),
    },
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      client: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  for (const visit of overlappingVisits) {
    if (timesOverlap(startTime, endTime, visit.scheduledStart, visit.scheduledEnd)) {
      conflicts.push({
        type: "OVERLAP",
        severity: "error",
        message: `Overlaps with visit for ${visit.client.firstName} ${visit.client.lastName} at ${formatTime(visit.scheduledStart)}-${formatTime(visit.scheduledEnd)}`,
        details: {
          conflictingVisitId: visit.id,
          conflictingTime: `${formatTime(visit.scheduledStart)}-${formatTime(visit.scheduledEnd)}`,
        },
      });
    }
  }

  // 2. Check for overlapping shift assignments
  const overlappingShifts = await db.shiftAssignment.findMany({
    where: {
      organisationId,
      staffProfileId,
      shift: {
        scheduledDate: dateOnly,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        ...(excludeShiftId && { id: { not: excludeShiftId } }),
      },
    },
    select: {
      id: true,
      shift: {
        select: {
          id: true,
          scheduledStart: true,
          scheduledEnd: true,
          locationName: true,
        },
      },
    },
  });

  for (const assignment of overlappingShifts) {
    const shiftStart = new Date(assignment.shift.scheduledStart);
    const shiftEnd = new Date(assignment.shift.scheduledEnd);
    // Extract time portion for comparison
    const shiftStartTime = new Date(1970, 0, 1, shiftStart.getHours(), shiftStart.getMinutes());
    const shiftEndTime = new Date(1970, 0, 1, shiftEnd.getHours(), shiftEnd.getMinutes());

    if (timesOverlap(startTime, endTime, shiftStartTime, shiftEndTime)) {
      conflicts.push({
        type: "DOUBLE_BOOKED",
        severity: "error",
        message: `Overlaps with shift at ${assignment.shift.locationName}`,
        details: {
          conflictingShiftId: assignment.shift.id,
          conflictingTime: `${formatTime(shiftStartTime)}-${formatTime(shiftEndTime)}`,
        },
      });
    }
  }

  // 3. Check for approved absences
  const absences = await db.staffAbsence.findMany({
    where: {
      staffProfileId,
      status: "APPROVED",
      startDate: { lte: dateOnly },
      endDate: { gte: dateOnly },
    },
    select: {
      id: true,
      type: true,
      isFullDay: true,
      startTime: true,
      endTime: true,
    },
  });

  for (const absence of absences) {
    if (absence.isFullDay) {
      conflicts.push({
        type: "DURING_LEAVE",
        severity: "error",
        message: `Staff is on ${absence.type.toLowerCase().replace("_", " ")}`,
        details: {
          absenceId: absence.id,
          absenceType: absence.type,
        },
      });
    } else if (absence.startTime && absence.endTime) {
      if (timesOverlap(startTime, endTime, absence.startTime, absence.endTime)) {
        conflicts.push({
          type: "DURING_LEAVE",
          severity: "error",
          message: `Staff is unavailable during ${formatTime(absence.startTime)}-${formatTime(absence.endTime)}`,
          details: {
            absenceId: absence.id,
            absenceType: absence.type,
          },
        });
      }
    }
  }

  // 4. Check against availability
  const availability = await db.staffAvailability.findMany({
    where: {
      staffProfileId,
      dayOfWeek,
      effectiveFrom: { lte: dateOnly },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: dateOnly } },
      ],
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      isPreferred: true,
    },
    orderBy: { effectiveFrom: "desc" },
    take: 1,
  });

  if (availability.length > 0) {
    const avail = availability[0];
    const availStart = avail.startTime;
    const availEnd = avail.endTime;

    // Check if the scheduled time is outside availability
    if (startTime < availStart || endTime > availEnd) {
      conflicts.push({
        type: "OUTSIDE_AVAILABILITY",
        severity: "warning",
        message: `Outside recorded availability (${formatTime(availStart)}-${formatTime(availEnd)})`,
        details: {
          availabilityId: avail.id,
          availableTime: `${formatTime(availStart)}-${formatTime(availEnd)}`,
        },
      });
    }
  }

  // 5. Check weekly hours threshold (if exceeded)
  const weekStart = new Date(dateOnly);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const staffProfile = await db.staffProfile.findUnique({
    where: { id: staffProfileId },
    select: { contractedWeeklyHours: true },
  });

  if (staffProfile) {
    const weeklyVisits = await db.careVisit.findMany({
      where: {
        organisationId,
        staffProfileId,
        scheduledDate: { gte: weekStart, lt: weekEnd },
        status: { in: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] },
        ...(excludeVisitId && { id: { not: excludeVisitId } }),
      },
      select: {
        scheduledStart: true,
        scheduledEnd: true,
      },
    });

    let totalMinutes = minutesBetween(startTime, endTime);
    for (const visit of weeklyVisits) {
      totalMinutes += minutesBetween(visit.scheduledStart, visit.scheduledEnd);
    }

    const totalHours = totalMinutes / 60;
    const contractedHours = Number(staffProfile.contractedWeeklyHours);

    if (totalHours > contractedHours * 1.25) { // Allow 25% overtime warning threshold
      conflicts.push({
        type: "EXCEEDS_HOURS",
        severity: "warning",
        message: `Total week hours (${totalHours.toFixed(1)}h) exceeds contracted hours (${contractedHours}h) by more than 25%`,
        details: {
          totalWeeklyHours: totalHours,
          contractedHours,
          percentOver: ((totalHours / contractedHours - 1) * 100).toFixed(0),
        },
      });
    }
  }

  return conflicts;
}

// Check travel time between two visits
export async function checkTravelTime(
  organisationId: string,
  fromPostcode: string | null,
  toPostcode: string | null,
  availableMinutes: number,
): Promise<SchedulingConflict | null> {
  if (!fromPostcode || !toPostcode) return null;

  // Normalize postcodes
  const fromNorm = fromPostcode.replace(/\s+/g, "").toUpperCase();
  const toNorm = toPostcode.replace(/\s+/g, "").toUpperCase();

  // Check for configured travel time
  const estimate = await db.travelTimeEstimate.findUnique({
    where: {
      organisationId_fromPostcode_toPostcode: {
        organisationId,
        fromPostcode: fromNorm,
        toPostcode: toNorm,
      },
    },
    select: { estimatedMinutes: true },
  });

  if (estimate && estimate.estimatedMinutes > availableMinutes) {
    return {
      type: "INSUFFICIENT_TRAVEL_TIME",
      severity: "warning",
      message: `Only ${availableMinutes} minutes between visits, but travel requires ${estimate.estimatedMinutes} minutes`,
      details: {
        fromPostcode: fromNorm,
        toPostcode: toNorm,
        estimatedMinutes: estimate.estimatedMinutes,
        availableMinutes,
      },
    };
  }

  return null;
}

// Get staff utilisation for a date range
export async function getStaffUtilisation(
  organisationId: string,
  staffProfileId: string,
  startDate: Date,
  endDate: Date,
): Promise<{
  scheduledHours: number;
  completedHours: number;
  contractedHours: number;
  utilizationPercent: number;
}> {
  const staffProfile = await db.staffProfile.findUnique({
    where: { id: staffProfileId },
    select: { contractedWeeklyHours: true },
  });

  const visits = await db.careVisit.findMany({
    where: {
      organisationId,
      staffProfileId,
      scheduledDate: { gte: startDate, lte: endDate },
      status: { in: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] },
    },
    select: {
      scheduledStart: true,
      scheduledEnd: true,
      actualStart: true,
      actualEnd: true,
      status: true,
    },
  });

  let scheduledMinutes = 0;
  let completedMinutes = 0;

  for (const visit of visits) {
    scheduledMinutes += minutesBetween(visit.scheduledStart, visit.scheduledEnd);
    if (visit.status === "COMPLETED" && visit.actualStart && visit.actualEnd) {
      completedMinutes += minutesBetween(visit.actualStart, visit.actualEnd);
    }
  }

  // Calculate number of weeks in range
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const weeks = Math.max(1, days / 7);
  const contractedHours = Number(staffProfile?.contractedWeeklyHours ?? 0) * weeks;

  return {
    scheduledHours: scheduledMinutes / 60,
    completedHours: completedMinutes / 60,
    contractedHours,
    utilizationPercent: contractedHours > 0 ? (scheduledMinutes / 60 / contractedHours) * 100 : 0,
  };
}
