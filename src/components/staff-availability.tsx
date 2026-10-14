"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendar, Clock, Save, X } from "lucide-react";

type AvailabilitySlot = {
  id?: string;
  dayOfWeek: number;
  dayName: string;
  startTimeStr: string;
  endTimeStr: string;
  isPreferred: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

type AvailabilityResponse = {
  data: {
    all: AvailabilitySlot[];
    current: AvailabilitySlot[];
  };
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface StaffAvailabilityProps {
  staffProfileId: string;
  canManage: boolean;
}

export function StaffAvailability({ staffProfileId, canManage }: StaffAvailabilityProps) {
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editSlots, setEditSlots] = useState<Record<number, { startTime: string; endTime: string; isPreferred: boolean; enabled: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;

    fetch(`/api/v1/staff/${staffProfileId}/availability`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load availability.");
        return body as AvailabilityResponse;
      })
      .then((body) => {
        if (active) {
          setAvailability(body.data.current);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "An error occurred.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [staffProfileId]);

  function startEditing() {
    // Initialize edit slots from current availability
    const slots: Record<number, { startTime: string; endTime: string; isPreferred: boolean; enabled: boolean }> = {};
    for (let day = 0; day < 7; day++) {
      const existing = availability.find((a) => a.dayOfWeek === day);
      if (existing) {
        slots[day] = {
          startTime: existing.startTimeStr,
          endTime: existing.endTimeStr,
          isPreferred: existing.isPreferred,
          enabled: true,
        };
      } else {
        slots[day] = {
          startTime: "09:00",
          endTime: "17:00",
          isPreferred: false,
          enabled: false,
        };
      }
    }
    setEditSlots(slots);
    setEditing(true);
    setSaveError("");
  }

  function cancelEditing() {
    setEditing(false);
    setEditSlots({});
    setSaveError("");
  }

  async function saveAvailability() {
    setSaving(true);
    setSaveError("");

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const availabilityData = Object.entries(editSlots)
        .filter(([_, slot]) => slot.enabled)
        .map(([day, slot]) => ({
          dayOfWeek: parseInt(day),
          startTime: slot.startTime,
          endTime: slot.endTime,
          isPreferred: slot.isPreferred,
          effectiveFrom: today.toISOString(),
        }));

      const response = await fetch(`/api/v1/staff/${staffProfileId}/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: availabilityData }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save availability.");

      // Reload availability
      const reloadResponse = await fetch(`/api/v1/staff/${staffProfileId}/availability`);
      const reloadBody = await reloadResponse.json();
      if (reloadResponse.ok) {
        setAvailability(reloadBody.data.current);
      }

      setEditing(false);
      setEditSlots({});
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  function updateSlot(day: number, field: keyof (typeof editSlots)[0], value: string | boolean) {
    setEditSlots((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading availability...</p>;
  }

  if (error) {
    return <div role="alert" className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-teal-700" />
          <h3 className="text-lg font-semibold text-slate-900">Weekly Availability</h3>
        </div>
        {canManage && !editing && (
          <button
            onClick={startEditing}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit availability
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
            {DAY_NAMES.map((dayName, dayIndex) => (
              <div key={dayIndex} className="flex items-center gap-4 p-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editSlots[dayIndex]?.enabled ?? false}
                    onChange={(e) => updateSlot(dayIndex, "enabled", e.target.checked)}
                    className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                  />
                  <span className="w-24 font-medium text-slate-900">{dayName}</span>
                </label>

                {editSlots[dayIndex]?.enabled && (
                  <>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-slate-400" />
                      <input
                        type="time"
                        value={editSlots[dayIndex]?.startTime ?? "09:00"}
                        onChange={(e) => updateSlot(dayIndex, "startTime", e.target.value)}
                        className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                      />
                      <span className="text-slate-500">to</span>
                      <input
                        type="time"
                        value={editSlots[dayIndex]?.endTime ?? "17:00"}
                        onChange={(e) => updateSlot(dayIndex, "endTime", e.target.value)}
                        className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={editSlots[dayIndex]?.isPreferred ?? false}
                        onChange={(e) => updateSlot(dayIndex, "isPreferred", e.target.checked)}
                        className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                      />
                      Preferred
                    </label>
                  </>
                )}
              </div>
            ))}
          </div>

          {saveError && (
            <p role="alert" className="text-sm text-rose-700">{saveError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={saveAvailability}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save availability"}
            </button>
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
          {DAY_NAMES.map((dayName, dayIndex) => {
            const slot = availability.find((a) => a.dayOfWeek === dayIndex);
            return (
              <div key={dayIndex} className="flex items-center justify-between p-4">
                <span className={`w-24 font-medium ${slot ? "text-slate-900" : "text-slate-400"}`}>
                  {dayName}
                </span>
                {slot ? (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-sm text-slate-600">
                      <Clock size={14} />
                      {slot.startTimeStr} – {slot.endTimeStr}
                    </span>
                    {slot.isPreferred && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                        Preferred
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">Not available</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
