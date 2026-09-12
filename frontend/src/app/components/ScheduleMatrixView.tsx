import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Clock,
  RefreshCw,
  Sparkles,
  Users,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { motion } from "motion/react";

export interface AvailabilitySlot {
  time: string;
  endTime: string;
  isOpen: boolean;
  occupiedCount: number;
  remainingCapacity: number;
  isFull: boolean;
  hasReservation: boolean;
}

export interface AvailabilityDate {
  date: string;
  dayLabel: string;
  display: string;
  slots: AvailabilitySlot[];
}

export interface AvailabilityResponse {
  area: {
    id: string;
    name: string;
    maxCapacity: number;
  };
  dates: AvailabilityDate[];
}

interface ScheduleMatrixViewProps {
  areaId: string;
  areaName: string;
  maxCapacity: number;
  selectedDate?: string;
  selectedStartTime?: string;
  selectedEndTime?: string;
  onSelectSlot?: (slot: { date: string; startTime: string; endTime: string }) => void;
  refreshNonce?: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
  : "";

const BASE_SLOT_HEIGHT_PX = 38;
const DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES = 8 * 60;

function getBusinessTimezoneOffsetMinutes() {
  const parsed = Number.parseInt(
    import.meta.env.VITE_BUSINESS_TIMEZONE_OFFSET_MINUTES ?? String(DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES),
    10
  );
  return Number.isFinite(parsed) ? parsed : DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES;
}

function parseBusinessDateTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const offsetMinutes = getBusinessTimezoneOffsetMinutes();
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - offsetMinutes * 60 * 1000);
}

function getDurationMinutes(startTime: string, endTime: string) {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
}

interface SlotSelection {
  date: string;
  startTime: string;
  endTime: string;
}

function getSelectableRange(
  day: AvailabilityDate,
  firstTime: string,
  lastTime: string
): SlotSelection | null {
  const slots = [...day.slots].sort((a, b) => a.time.localeCompare(b.time));
  const firstIndex = slots.findIndex((slot) => slot.time === firstTime);
  const lastIndex = slots.findIndex((slot) => slot.time === lastTime);

  if (firstIndex < 0 || lastIndex < 0) return null;

  const startIndex = Math.min(firstIndex, lastIndex);
  const endIndex = Math.max(firstIndex, lastIndex);
  const selectedSlots = slots.slice(startIndex, endIndex + 1);
  const now = new Date();

  for (let index = 0; index < selectedSlots.length; index += 1) {
    const slot = selectedSlots[index];
    const isPast = parseBusinessDateTime(day.date, slot.time) < now;

    if (!slot.isOpen || slot.isFull || isPast) return null;
    if (index > 0 && selectedSlots[index - 1].endTime !== slot.time) return null;
  }

  return {
    date: day.date,
    startTime: selectedSlots[0].time,
    endTime: selectedSlots[selectedSlots.length - 1].endTime,
  };
}

export function ScheduleMatrixView({
  areaId,
  areaName,
  maxCapacity,
  selectedDate,
  selectedStartTime,
  selectedEndTime,
  onSelectSlot,
  refreshNonce = 0,
}: ScheduleMatrixViewProps) {
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localNonce, setLocalNonce] = useState(0);
  const [selectionAnchor, setSelectionAnchor] = useState<{ date: string; time: string } | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const dragOriginRef = useRef<{ date: string; time: string } | null>(null);
  const dragMovedRef = useRef(false);
  const ignoreClickUntilRef = useRef(0);

  useEffect(() => {
    setSelectionAnchor(null);
    setSelectionError(null);
    dragOriginRef.current = null;
    dragMovedRef.current = false;
  }, [areaId]);

  useEffect(() => {
    const finishPointerSelection = () => {
      if (dragMovedRef.current) {
        setSelectionAnchor(null);
        ignoreClickUntilRef.current = Date.now() + 100;
      }
      dragOriginRef.current = null;
      dragMovedRef.current = false;
    };

    window.addEventListener("pointerup", finishPointerSelection);
    window.addEventListener("pointercancel", finishPointerSelection);
    return () => {
      window.removeEventListener("pointerup", finishPointerSelection);
      window.removeEventListener("pointercancel", finishPointerSelection);
    };
  }, []);

  useEffect(() => {
    if (!areaId) return;

    let cancelled = false;

    const loadAvailability = async () => {
      try {
        setLoading(true);
        setError(null);
        const endpoint = `${API_BASE_URL}/api/areas/${areaId}/availability`;
        const response = await fetch(endpoint);

        if (!response.ok) {
          throw new Error(`Failed to load availability (status ${response.status})`);
        }

        const payload = (await response.json()) as AvailabilityResponse;
        if (!cancelled) {
          setAvailability(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load schedule");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [areaId, refreshNonce, localNonce]);

  const gridRows = useMemo(() => {
    const slots = availability?.dates.flatMap((entry) => entry.slots) ?? [];
    const rowMap = new Map<string, { time: string; endTime: string }>();

    for (const slot of slots) {
      if (!rowMap.has(slot.time)) {
        rowMap.set(slot.time, { time: slot.time, endTime: slot.endTime });
      }
    }

    return [...rowMap.values()].sort((a, b) => a.time.localeCompare(b.time));
  }, [availability]);

  const effectiveMaxCapacity = availability?.area.maxCapacity ?? maxCapacity;

  const selectRange = (date: string, firstTime: string, lastTime: string) => {
    const day = availability?.dates.find((entry) => entry.date === date);
    const range = day ? getSelectableRange(day, firstTime, lastTime) : null;

    if (!range) {
      setSelectionError("所選區間包含已額滿、已過期或不連續的時段，請改選同一天內的連續可用時段。");
      return false;
    }

    setSelectionError(null);
    onSelectSlot?.(range);
    return true;
  };

  const handleSlotClick = (date: string, time: string) => {
    if (Date.now() < ignoreClickUntilRef.current) return;

    if (selectionAnchor?.date === date) {
      if (selectionAnchor.time === time) {
        selectRange(date, time, time);
        setSelectionAnchor(null);
        return;
      }

      if (selectRange(date, selectionAnchor.time, time)) {
        setSelectionAnchor(null);
      }
      return;
    }

    selectRange(date, time, time);
    setSelectionAnchor({ date, time });
  };

  const beginDragSelection = (date: string, time: string, pointerType: string, button: number) => {
    if (pointerType !== "mouse" || button !== 0) return;
    dragOriginRef.current = { date, time };
    dragMovedRef.current = false;
  };

  const extendDragSelection = (date: string, time: string, buttons: number) => {
    const origin = dragOriginRef.current;
    if (!origin || (buttons & 1) !== 1 || origin.time === time) return;

    dragMovedRef.current = true;
    if (origin.date !== date) {
      setSelectionError("一次只能選取同一天的連續時段。");
      return;
    }

    selectRange(date, origin.time, time);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold font-mono text-slate-100 uppercase tracking-tight">
                {areaName}
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono border border-slate-700">
                Max: {effectiveMaxCapacity} seats
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Click a start and end slot, or drag across slots, to select a continuous reservation period.
            </p>
          </div>
        </div>

        {/* Legend and Refresh */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-[10px] font-mono font-medium text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
              Free
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/40" />
              Occupied
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/20 border border-rose-500/40" />
              Full
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-950 border border-slate-800" />
              Closed
            </span>
          </div>

          <button
            onClick={() => setLocalNonce((n) => n + 1)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Refresh availability"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {loading && !availability ? (
          <div className="flex flex-col items-center justify-center h-80 text-slate-500 space-y-3 font-mono text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            <span>CONNECTING_TO_TERMINAL_SCHEDULE...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <div className="text-sm font-mono text-rose-200">{error}</div>
            <button
              onClick={() => setLocalNonce((n) => n + 1)}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="w-full">
            {/* Weekday Date Headers */}
            <div className="flex border-b border-slate-800/80 pb-2.5 mb-2">
              <div className="w-14 sm:w-16 shrink-0 pr-1.5 sm:pr-2 text-[9px] sm:text-[10px] uppercase font-mono font-bold text-slate-500 flex items-center justify-end">
                SLOT
              </div>
              {availability?.dates.map((day) => (
                <div
                  key={day.date}
                  className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-1 rounded-lg mx-0.5 sm:mx-1 text-center ${
                    selectedDate === day.date
                      ? "bg-emerald-500/10 border border-emerald-500/30"
                      : "bg-slate-950/40 border border-slate-800/50"
                  }`}
                >
                  <span className="text-[11px] sm:text-xs font-bold font-mono text-slate-200 tracking-wider uppercase truncate w-full">
                    {day.dayLabel}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono text-slate-500 truncate w-full">{day.display}</span>
                </div>
              ))}
            </div>

            {/* Time Slot Rows */}
            <div className="space-y-1 sm:space-y-1.5">
              {gridRows.map((row) => {
                const rowDuration = getDurationMinutes(row.time, row.endTime);
                const rowHeight = Math.max(34, Math.round((BASE_SLOT_HEIGHT_PX * rowDuration) / 30));

                return (
                  <div key={row.time} className="flex items-center group">
                    {/* Time Label on left */}
                    <div
                      style={{ height: `${rowHeight}px` }}
                      className="w-14 sm:w-16 shrink-0 pr-1.5 sm:pr-2 text-[10px] sm:text-[11px] font-mono text-slate-500 flex flex-col items-end justify-center leading-tight group-hover:text-slate-300 transition-colors"
                    >
                      <span className="font-semibold text-slate-400">{row.time}</span>
                      <span className="text-[9px] text-slate-600 hidden sm:inline">{row.endTime}</span>
                    </div>

                    {/* Day Cells */}
                    {availability?.dates.map((day) => {
                      const slot = day.slots.find((s) => s.time === row.time);

                      if (!slot) {
                        return (
                          <div
                            key={`${day.date}-${row.time}`}
                            style={{ height: `${rowHeight}px` }}
                            className="flex-1 min-w-0 mx-0.5 sm:mx-1 rounded-lg border border-slate-800/30 bg-slate-950/40 flex items-center justify-center text-[10px] font-mono text-slate-700"
                          >
                            —
                          </div>
                        );
                      }

                      const slotDateTime = parseBusinessDateTime(day.date, slot.time);
                      const isPast = slotDateTime < new Date();
                      const isSelected =
                        selectedDate === day.date &&
                        Boolean(selectedStartTime) &&
                        Boolean(selectedEndTime) &&
                        slot.time >= selectedStartTime! &&
                        slot.endTime <= selectedEndTime!;
                      const isRangeStart = isSelected && selectedStartTime === slot.time;
                      const isRangeEnd = isSelected && selectedEndTime === slot.endTime;
                      const isAnchor = selectionAnchor?.date === day.date && selectionAnchor.time === slot.time;

                      const isClickable = slot.isOpen && !isPast && !slot.isFull;

                      let cellBg = "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-600";
                      let badgeColor = "bg-slate-800/80 text-slate-400 border-slate-700";
                      let label = `${slot.occupiedCount}/${effectiveMaxCapacity}`;

                      if (!slot.isOpen) {
                        cellBg = "bg-slate-950/80 border-slate-900 text-slate-700 cursor-not-allowed";
                        label = "CLOSED";
                        badgeColor = "bg-slate-950 text-slate-700 border-slate-900";
                      } else if (isPast) {
                        cellBg = "bg-slate-950/60 border-slate-900/80 text-slate-600 cursor-not-allowed";
                        label = "PAST";
                        badgeColor = "bg-slate-950 text-slate-700 border-slate-900";
                      } else if (isSelected) {
                        cellBg = "bg-emerald-500/25 border-emerald-500 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400";
                        badgeColor = "bg-emerald-500 text-slate-950 font-bold border-emerald-400";
                        label = isRangeStart && isRangeEnd ? "SELECTED" : isRangeStart ? "START" : isRangeEnd ? "END" : "SELECTED";
                      } else if (slot.isFull) {
                        cellBg = "bg-rose-500/10 border-rose-500/30 text-rose-300";
                        badgeColor = "bg-rose-500/20 text-rose-300 border-rose-500/40";
                        label = "FULL";
                      } else if (slot.occupiedCount > 0) {
                        cellBg = "bg-amber-500/10 border-amber-500/30 text-amber-200 hover:bg-amber-500/20";
                        badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/40";
                      } else {
                        cellBg = "bg-slate-900/60 border-slate-800 hover:bg-emerald-500/15 hover:border-emerald-500/50 text-slate-300";
                        badgeColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
                        label = "FREE";
                      }

                      return (
                        <button
                          key={`${day.date}-${slot.time}`}
                          type="button"
                          disabled={!isClickable}
                          onPointerDown={(event) =>
                            beginDragSelection(day.date, slot.time, event.pointerType, event.button)
                          }
                          onPointerEnter={(event) =>
                            extendDragSelection(day.date, slot.time, event.buttons)
                          }
                          onClick={() => handleSlotClick(day.date, slot.time)}
                          style={{ height: `${rowHeight}px` }}
                          className={`flex-1 min-w-0 mx-0.5 sm:mx-1 px-1.5 sm:px-2 py-1 rounded-lg border flex items-center justify-between transition-all font-mono text-xs select-none ${cellBg} ${
                            isClickable ? "cursor-pointer active:scale-[0.98]" : ""
                          } ${isAnchor ? "outline outline-2 outline-offset-1 outline-cyan-400" : ""}`}
                          title={`${day.date} ${slot.time}-${slot.endTime}: ${slot.occupiedCount}/${effectiveMaxCapacity} occupied`}
                        >
                          <span className="text-[10px] sm:text-[11px] font-semibold tracking-tighter truncate">
                            {slot.time}
                          </span>

                          <span
                            className={`px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold border truncate shrink-0 ${badgeColor}`}
                          >
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectionError && (
        <div className="px-5 py-2 border-t border-rose-500/20 bg-rose-500/10 text-[11px] font-mono text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {selectionError}
        </div>
      )}

      {/* Footer tip */}
      <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/80 text-[11px] font-mono text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          Click the first and last slot, or hold and drag, to select a continuous period.
        </span>
        <span className="flex items-center gap-3">
          {selectedDate && selectedStartTime && selectedEndTime && (
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <Clock className="w-3.5 h-3.5" />
              {selectedDate} {selectedStartTime}–{selectedEndTime}
            </span>
          )}
          <span className="text-slate-600">Asia/Taipei (UTC+8)</span>
        </span>
      </div>
    </div>
  );
}
