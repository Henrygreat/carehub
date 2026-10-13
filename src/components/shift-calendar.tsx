"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, Plus, Users } from "lucide-react";

type ShiftAssignment = {
  id: string;
  status: string;
  staffProfile: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type Shift = {
  id: string;
  shiftReference: string;
  locationName: string;
  locationAddress?: string | null;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  isOvernight: boolean;
  assignments: ShiftAssignment[];
};

type ShiftsResponse = {
  data: Shift[];
  pagination: { total: number };
};

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-50 border-blue-200 text-blue-800",
  IN_PROGRESS: "bg-amber-50 border-amber-200 text-amber-800",
  COMPLETED: "bg-emerald-50 border-emerald-200 text-emerald-800",
  CANCELLED: "bg-slate-50 border-slate-200 text-slate-500",
};

const statusLabel: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function ShiftCalendar({ canCreate }: { canCreate: boolean }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday as start
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(currentWeekStart.getDate() + 6);

  const weekDates = formatDateRange(currentWeekStart, weekEnd);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const startDate = currentWeekStart.toISOString().split("T")[0];
    const endDate = weekEnd.toISOString().split("T")[0];

    fetch(`/api/v1/shifts?startDate=${startDate}&endDate=${endDate}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load shifts.");
        return body as ShiftsResponse;
      })
      .then((body) => {
        if (active) {
          setShifts(body.data);
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
  }, [currentWeekStart]);

  function previousWeek() {
    setLoading(true);
    setCurrentWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7);
      return newDate;
    });
  }

  function nextWeek() {
    setLoading(true);
    setCurrentWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7);
      return newDate;
    });
  }

  function goToToday() {
    setLoading(true);
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  }

  // Group shifts by date
  const shiftsByDate: Record<string, Shift[]> = {};
  for (const date of weekDates) {
    shiftsByDate[date] = [];
  }
  for (const shift of shifts) {
    const dateKey = shift.scheduledDate.split("T")[0];
    if (shiftsByDate[dateKey]) {
      shiftsByDate[dateKey].push(shift);
    }
  }

  // Sort shifts within each day by start time
  for (const date of weekDates) {
    shiftsByDate[date].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  }

  const weekLabel = `${currentWeekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-teal-700">Scheduling</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Shifts</h1>
          <p className="mt-2 text-sm text-slate-500">Fixed location shifts and overnight coverage.</p>
        </div>
        {canCreate && (
          <Link
            href="/shifts/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus size={17} aria-hidden="true" /> Create shift
          </Link>
        )}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={previousWeek}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              title="Previous week"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextWeek}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              title="Next week"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={goToToday}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">{weekLabel}</h2>
        </div>

        {error ? (
          <div role="alert" className="p-8 text-center text-sm text-rose-700">
            {error}
          </div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading shifts...</div>
        ) : (
          <div className="grid grid-cols-7 divide-x divide-slate-200">
            {weekDates.map((dateStr) => {
              const date = new Date(dateStr + "T00:00:00");
              const isToday = dateStr === new Date().toISOString().split("T")[0];
              const dayShifts = shiftsByDate[dateStr];

              return (
                <div key={dateStr} className="min-h-[300px]">
                  <div
                    className={`border-b border-slate-200 p-3 text-center ${isToday ? "bg-teal-50" : "bg-slate-50"}`}
                  >
                    <p className="text-xs font-medium uppercase text-slate-500">
                      {date.toLocaleDateString("en-GB", { weekday: "short" })}
                    </p>
                    <p
                      className={`mt-1 text-lg font-semibold ${isToday ? "text-teal-700" : "text-slate-900"}`}
                    >
                      {date.getDate()}
                    </p>
                  </div>
                  <div className="space-y-2 p-2">
                    {dayShifts.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-400">No shifts</p>
                    ) : (
                      dayShifts.map((shift) => (
                        <Link
                          key={shift.id}
                          href={`/shifts/${shift.id}`}
                          className={`block rounded-lg border p-2 text-xs transition hover:shadow-sm ${statusColors[shift.status] ?? "bg-slate-50 border-slate-200"}`}
                        >
                          <div className="flex items-center gap-1 font-medium">
                            <Clock size={12} />
                            {formatTime(shift.scheduledStart)} – {formatTime(shift.scheduledEnd)}
                            {shift.isOvernight && (
                              <span className="ml-1 text-[10px] text-slate-500">(overnight)</span>
                            )}
                          </div>
                          <p className="mt-1 flex items-center gap-1 font-semibold text-slate-900">
                            <MapPin size={10} /> {shift.locationName}
                          </p>
                          <div className="mt-1 flex items-center gap-1 text-slate-600">
                            <Users size={10} />
                            {shift.assignments.length === 0 ? (
                              <span className="text-amber-600">Unassigned</span>
                            ) : (
                              <span>
                                {shift.assignments.length} staff
                              </span>
                            )}
                          </div>
                          <span
                            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColors[shift.status]}`}
                          >
                            {statusLabel[shift.status]}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
