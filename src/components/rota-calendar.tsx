"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  MapPin,
  Palmtree,
  User,
  Users,
} from "lucide-react";

type Visit = {
  id: string;
  scheduledDate: string;
  scheduledStartStr: string;
  scheduledEndStr: string;
  status: string;
  visitType: string | null;
  notes: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    clientReference: string | null;
    postcode: string | null;
  };
  staffProfile: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
  } | null;
  recurrence: { id: string; frequency: string } | null;
};

type Shift = {
  id: string;
  scheduledDate: string;
  scheduledStartStr: string;
  scheduledEndStr: string;
  status: string;
  locationName: string;
  assignments: Array<{
    id: string;
    staffProfile: { id: string; firstName: string; lastName: string };
  }>;
};

type Absence = {
  id: string;
  staffProfileId: string;
  type: string;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  staffProfile: { firstName: string; lastName: string };
};

type RotaData = {
  visits: Visit[];
  shifts: Shift[];
  absences: Absence[];
};

type StaffProfile = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string | null;
};

type ViewMode = "day" | "week" | "month";
type FilterMode = "all" | "staff" | "client";

type Conflict = {
  type: string;
  severity: "warning" | "error";
  message: string;
  details: string;
};

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-50 border-blue-200 text-blue-800",
  IN_PROGRESS: "bg-amber-50 border-amber-200 text-amber-800",
  COMPLETED: "bg-emerald-50 border-emerald-200 text-emerald-800",
  MISSED: "bg-rose-50 border-rose-200 text-rose-800",
  CANCELLED: "bg-slate-50 border-slate-200 text-slate-500",
};

const absenceTypeLabels: Record<string, string> = {
  ANNUAL_LEAVE: "Annual leave",
  SICK_LEAVE: "Sick leave",
  UNPAID_LEAVE: "Unpaid leave",
  TRAINING: "Training",
  MATERNITY_LEAVE: "Maternity leave",
  PATERNITY_LEAVE: "Paternity leave",
  COMPASSIONATE: "Compassionate",
  OTHER: "Other",
};

function formatDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

interface RotaCalendarProps {
  canManage: boolean;
  staffList?: StaffProfile[];
}

export function RotaCalendar({ canManage, staffList = [] }: RotaCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const [data, setData] = useState<RotaData>({ visits: [], shifts: [], absences: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [draggedVisit, setDraggedVisit] = useState<Visit | null>(null);
  const [rescheduleModal, setRescheduleModal] = useState<{
    visit: Visit;
    targetDate: string;
    targetStaffId?: string;
  } | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [rescheduleError, setRescheduleError] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Calculate date range based on view mode
  const getDateRange = useCallback(() => {
    let startDate: Date;
    let endDate: Date;

    if (viewMode === "day") {
      startDate = new Date(currentDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
    } else if (viewMode === "week") {
      startDate = getWeekStart(currentDate);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else {
      startDate = getMonthStart(currentDate);
      endDate = getMonthEnd(currentDate);
    }

    return { startDate, endDate };
  }, [viewMode, currentDate]);

  // Fetch rota data
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const { startDate, endDate } = getDateRange();
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    });

    if (filterMode === "staff" && selectedStaffId) {
      params.set("staffProfileId", selectedStaffId);
    }

    setLoading(true);
    fetch(`/api/v1/rota?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load rota.");
        return body.data as RotaData;
      })
      .then((rotaData) => {
        if (active) {
          setData(rotaData);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active && reason instanceof Error && reason.name !== "AbortError") {
          setError(reason.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [getDateRange, filterMode, selectedStaffId]);

  // Navigation handlers
  function navigate(direction: "prev" | "next" | "today") {
    setCurrentDate((prev) => {
      if (direction === "today") return new Date();

      const delta = direction === "prev" ? -1 : 1;
      const newDate = new Date(prev);

      if (viewMode === "day") {
        newDate.setDate(prev.getDate() + delta);
      } else if (viewMode === "week") {
        newDate.setDate(prev.getDate() + delta * 7);
      } else {
        newDate.setMonth(prev.getMonth() + delta);
      }

      return newDate;
    });
  }

  // Drag-drop handlers
  function handleDragStart(e: React.DragEvent, visit: Visit) {
    if (!canManage || visit.status === "COMPLETED" || visit.status === "CANCELLED") return;
    setDraggedVisit(visit);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    if (!draggedVisit) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, targetDate: string, targetStaffId?: string) {
    e.preventDefault();
    if (!draggedVisit || !canManage) return;

    // Show reschedule confirmation modal
    setRescheduleModal({
      visit: draggedVisit,
      targetDate,
      targetStaffId,
    });
    setDraggedVisit(null);
  }

  // Reschedule visit
  async function handleReschedule(overrideConflicts = false) {
    if (!rescheduleModal) return;

    setRescheduleLoading(true);
    setRescheduleError("");

    try {
      const { visit, targetDate, targetStaffId } = rescheduleModal;

      const response = await fetch(`/api/v1/rota?visitId=${visit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledDate: targetDate,
          scheduledStart: visit.scheduledStartStr,
          scheduledEnd: visit.scheduledEndStr,
          staffProfileId: targetStaffId ?? visit.staffProfile?.id,
          overrideConflicts,
        }),
      });

      const body = await response.json();

      if (response.status === 409) {
        // Conflicts detected
        setConflicts(body.conflicts ?? []);
        return;
      }

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to reschedule visit.");
      }

      // Success - refresh data
      setRescheduleModal(null);
      setConflicts([]);
      navigate("today"); // Trigger refresh
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setRescheduleLoading(false);
    }
  }

  // Get date label
  const { startDate, endDate } = getDateRange();
  let dateLabel: string;
  if (viewMode === "day") {
    dateLabel = startDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } else if (viewMode === "week") {
    dateLabel = `${startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  } else {
    dateLabel = startDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

  const dates = formatDateRange(startDate, endDate);

  // Group visits by date and optionally by staff
  const visitsByDateAndStaff: Record<string, Record<string, Visit[]>> = {};
  for (const date of dates) {
    visitsByDateAndStaff[date] = { unassigned: [] };
    for (const staff of staffList) {
      visitsByDateAndStaff[date][staff.id] = [];
    }
  }

  for (const visit of data.visits) {
    const dateKey = visit.scheduledDate.split("T")[0];
    if (!visitsByDateAndStaff[dateKey]) continue;

    const staffKey = visit.staffProfile?.id ?? "unassigned";
    if (!visitsByDateAndStaff[dateKey][staffKey]) {
      visitsByDateAndStaff[dateKey][staffKey] = [];
    }
    visitsByDateAndStaff[dateKey][staffKey].push(visit);
  }

  // Sort visits by time
  for (const date of dates) {
    for (const staffKey of Object.keys(visitsByDateAndStaff[date])) {
      visitsByDateAndStaff[date][staffKey].sort((a, b) =>
        a.scheduledStartStr.localeCompare(b.scheduledStartStr)
      );
    }
  }

  // Check if staff has absence on date
  function hasAbsenceOnDate(staffProfileId: string, dateStr: string): Absence | null {
    return data.absences.find((a) => {
      if (a.staffProfileId !== staffProfileId) return false;
      const date = new Date(dateStr);
      const start = new Date(a.startDate);
      const end = new Date(a.endDate);
      return date >= start && date <= end;
    }) ?? null;
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("prev")}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            title={viewMode === "day" ? "Previous day" : viewMode === "week" ? "Previous week" : "Previous month"}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => navigate("next")}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            title={viewMode === "day" ? "Next day" : viewMode === "week" ? "Next week" : "Next month"}
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={() => navigate("today")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
          <h2 className="ml-4 text-lg font-semibold text-slate-900">{dateLabel}</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-slate-300 p-1">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded px-3 py-1 text-sm font-medium transition ${
                  viewMode === mode
                    ? "bg-teal-700 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Filter mode */}
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="all">All staff</option>
            <option value="staff">By staff member</option>
          </select>

          {filterMode === "staff" && (
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">Select staff...</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <div role="alert" className="p-8 text-center text-sm text-rose-700">
            {error}
          </div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading rota...</div>
        ) : viewMode === "week" || viewMode === "day" ? (
          <div className={`grid divide-x divide-slate-200 ${viewMode === "day" ? "grid-cols-1" : "grid-cols-7"}`}>
            {dates.map((dateStr) => {
              const date = new Date(dateStr + "T00:00:00");
              const isToday = dateStr === new Date().toISOString().split("T")[0];
              const dayVisits = Object.values(visitsByDateAndStaff[dateStr] ?? {}).flat();

              return (
                <div
                  key={dateStr}
                  className={`min-h-[300px] ${viewMode === "day" ? "" : ""}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, dateStr)}
                >
                  <div
                    className={`border-b border-slate-200 p-3 text-center ${isToday ? "bg-teal-50" : "bg-slate-50"}`}
                  >
                    <p className="text-xs font-medium uppercase text-slate-500">
                      {date.toLocaleDateString("en-GB", { weekday: "short" })}
                    </p>
                    <p className={`mt-1 text-lg font-semibold ${isToday ? "text-teal-700" : "text-slate-900"}`}>
                      {date.getDate()}
                    </p>
                  </div>

                  {/* Absences banner */}
                  {data.absences
                    .filter((a) => {
                      const start = new Date(a.startDate);
                      const end = new Date(a.endDate);
                      const d = new Date(dateStr);
                      return d >= start && d <= end;
                    })
                    .slice(0, 3)
                    .map((absence) => (
                      <div
                        key={absence.id}
                        className="mx-2 mt-2 flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700"
                      >
                        <Palmtree size={12} />
                        <span className="truncate">
                          {absence.staffProfile.firstName} {absence.staffProfile.lastName.charAt(0)}. - {absenceTypeLabels[absence.type] ?? absence.type}
                        </span>
                      </div>
                    ))}

                  <div className="space-y-2 p-2">
                    {dayVisits.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-400">No visits</p>
                    ) : (
                      dayVisits.map((visit) => (
                        <div
                          key={visit.id}
                          draggable={canManage && visit.status !== "COMPLETED" && visit.status !== "CANCELLED"}
                          onDragStart={(e) => handleDragStart(e, visit)}
                          className={`group relative block rounded-lg border p-2 text-xs transition hover:shadow-sm ${statusColors[visit.status] ?? "bg-slate-50 border-slate-200"} ${
                            canManage && visit.status !== "COMPLETED" && visit.status !== "CANCELLED"
                              ? "cursor-grab active:cursor-grabbing"
                              : ""
                          }`}
                        >
                          {canManage && visit.status !== "COMPLETED" && visit.status !== "CANCELLED" && (
                            <div className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100">
                              <GripVertical size={14} className="text-slate-400" />
                            </div>
                          )}
                          <Link href={`/visits/${visit.id}`} className="block">
                            <div className="flex items-center gap-1 font-medium">
                              <Clock size={12} />
                              {visit.scheduledStartStr} – {visit.scheduledEndStr}
                            </div>
                            <p className="mt-1 font-semibold text-slate-900">
                              {visit.client.firstName} {visit.client.lastName}
                            </p>
                            {visit.client.postcode && (
                              <p className="mt-0.5 flex items-center gap-1 text-slate-600">
                                <MapPin size={10} /> {visit.client.postcode}
                              </p>
                            )}
                            {visit.staffProfile ? (
                              <p className="mt-1 flex items-center gap-1 text-slate-600">
                                <User size={10} /> {visit.staffProfile.firstName} {visit.staffProfile.lastName.charAt(0)}.
                              </p>
                            ) : (
                              <p className="mt-1 flex items-center gap-1 text-amber-600">
                                <AlertCircle size={10} /> Unassigned
                              </p>
                            )}
                            {visit.recurrence && (
                              <p className="mt-0.5 flex items-center gap-1 text-slate-500">
                                <Calendar size={10} /> {visit.recurrence.frequency}
                              </p>
                            )}
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Month view */
          <div className="grid grid-cols-7">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="border-b border-slate-200 bg-slate-50 p-2 text-center text-xs font-medium text-slate-600">
                {day}
              </div>
            ))}
            {(() => {
              const monthStart = getMonthStart(currentDate);
              const monthEnd = getMonthEnd(currentDate);
              const startDay = monthStart.getDay() || 7;
              const cells: React.ReactNode[] = [];

              // Empty cells for days before month start
              for (let i = 1; i < startDay; i++) {
                cells.push(<div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-slate-100 bg-slate-50/50" />);
              }

              // Days of the month
              for (let day = 1; day <= monthEnd.getDate(); day++) {
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = dateStr === new Date().toISOString().split("T")[0];
                const dayVisits = Object.values(visitsByDateAndStaff[dateStr] ?? {}).flat();
                const dayAbsences = data.absences.filter((a) => {
                  const d = new Date(dateStr);
                  return d >= new Date(a.startDate) && d <= new Date(a.endDate);
                });

                cells.push(
                  <div
                    key={dateStr}
                    className={`min-h-[100px] border-b border-r border-slate-100 p-1 ${isToday ? "bg-teal-50/50" : ""}`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, dateStr)}
                  >
                    <p className={`text-right text-sm font-medium ${isToday ? "text-teal-700" : "text-slate-700"}`}>
                      {day}
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {dayAbsences.length > 0 && (
                        <div className="flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700">
                          <Palmtree size={10} /> {dayAbsences.length} off
                        </div>
                      )}
                      {dayVisits.slice(0, 3).map((visit) => (
                        <Link
                          key={visit.id}
                          href={`/visits/${visit.id}`}
                          className={`block truncate rounded px-1 py-0.5 text-[10px] ${statusColors[visit.status]}`}
                        >
                          {visit.scheduledStartStr} {visit.client.lastName}
                        </Link>
                      ))}
                      {dayVisits.length > 3 && (
                        <p className="text-center text-[10px] text-slate-500">+{dayVisits.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              }

              return cells;
            })()}
          </div>
        )}
      </section>

      {/* Shifts section */}
      {data.shifts.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Shifts</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.shifts.map((shift) => (
              <Link
                key={shift.id}
                href={`/shifts/${shift.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {new Date(shift.scheduledDate).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    {" "}{shift.scheduledStartStr} – {shift.scheduledEndStr}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-600">
                    <MapPin size={14} /> {shift.locationName}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  <Users size={14} />
                  {shift.assignments.length === 0 ? (
                    <span className="text-amber-600">Unassigned</span>
                  ) : (
                    <span>{shift.assignments.length} staff</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Reschedule Visit</h3>
            <p className="mt-2 text-sm text-slate-600">
              Move visit for <strong>{rescheduleModal.visit.client.firstName} {rescheduleModal.visit.client.lastName}</strong> to{" "}
              <strong>{new Date(rescheduleModal.targetDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</strong>?
            </p>

            {conflicts.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-rose-700">Scheduling conflicts detected:</p>
                {conflicts.map((c, i) => (
                  <div key={i} className={`rounded-lg p-3 text-sm ${c.severity === "error" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                    <p className="font-medium">{c.message}</p>
                    <p className="mt-0.5 text-xs">{c.details}</p>
                  </div>
                ))}
              </div>
            )}

            {rescheduleError && (
              <p className="mt-4 text-sm text-rose-700">{rescheduleError}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setRescheduleModal(null);
                  setConflicts([]);
                  setRescheduleError("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={rescheduleLoading}
              >
                Cancel
              </button>
              {conflicts.length > 0 ? (
                <button
                  onClick={() => handleReschedule(true)}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  disabled={rescheduleLoading}
                >
                  {rescheduleLoading ? "Saving..." : "Override & Save"}
                </button>
              ) : (
                <button
                  onClick={() => handleReschedule(false)}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  disabled={rescheduleLoading}
                >
                  {rescheduleLoading ? "Saving..." : "Confirm"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
