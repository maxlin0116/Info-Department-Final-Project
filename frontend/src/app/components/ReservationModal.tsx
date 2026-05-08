import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { X, Calendar, Clock, Users as UsersIcon, CheckCircle2, LogIn } from "lucide-react";
import { useAuth } from "../auth";

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  areaId: string | null;
  resourceName: string;
  maxCapacity: number;
  onReservationCreated?: () => void;
}

interface AvailabilitySlot {
  time: string;
  isOpen: boolean;
  occupiedCount: number;
  remainingCapacity: number;
  isFull: boolean;
  hasReservation: boolean;
}

interface AvailabilityDate {
  date: string;
  dayLabel: string;
  display: string;
  slots: AvailabilitySlot[];
}

interface AvailabilityResponse {
  area: {
    id: string;
    name: string;
    maxCapacity: number;
  };
  dates: AvailabilityDate[];
}

interface PlannedItemPayload {
  category: "other";
  name: string;
  quantity: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
  : "";

function addMinutesToTime(time: string, deltaMinutes: number) {
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + deltaMinutes;
  const nextHours = Math.floor(total / 60);
  const nextMinutes = total % 60;
  return String(nextHours).padStart(2, "0") + ":" + String(nextMinutes).padStart(2, "0");
}

function toIsoDateTime(date: string, time: string) {
  return new Date(date + "T" + time + ":00").toISOString();
}

async function readErrorMessage(response: Response) {
  const text = await response.text();
  if (!text) {
    return "Request failed with status " + response.status;
  }

  try {
    const payload = JSON.parse(text) as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : "Request failed with status " + response.status;
  } catch {
    return text;
  }
}

function parsePlannedItems(input: string): PlannedItemPayload[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({
      category: "other" as const,
      name,
      quantity: 1,
    }));
}

export function ReservationModal({
  isOpen,
  onClose,
  areaId,
  resourceName,
  maxCapacity,
  onReservationCreated,
}: ReservationModalProps) {
  const navigate = useNavigate();
  const { token, isAuthenticated, logout } = useAuth();
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [people, setPeople] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [plannedItemsInput, setPlannedItemsInput] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [when2meet, setWhen2meet] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveMaxCapacity = availability?.area.maxCapacity ?? maxCapacity;
  const selectedPeople = Math.max(1, Number.parseInt(people, 10) || 1);
  const gridSlots = availability?.dates[0]?.slots.map((slot) => slot.time) ?? [];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsSuccess(false);
    setDate("");
    setStartTime("");
    setEndTime("");
    setPeople("1");
    setPurpose("");
    setPlannedItemsInput("");
    setProjectNotes("");
    setWhen2meet("");
    setError(null);
    setAvailability(null);

    if (!areaId) {
      return;
    }

    let cancelled = false;

    const loadAvailability = async () => {
      try {
        setLoading(true);
        const endpoint = API_BASE_URL
          ? API_BASE_URL + "/api/areas/" + areaId + "/availability"
          : "/api/areas/" + areaId + "/availability";
        const response = await fetch(endpoint);

        if (!response.ok) {
          throw new Error("Availability request failed with " + response.status);
        }

        const payload = (await response.json()) as AvailabilityResponse;
        if (!payload || !Array.isArray(payload.dates)) {
          throw new Error("Invalid availability response");
        }

        if (!cancelled) {
          setAvailability(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof TypeError
              ? "Cannot reach the backend availability API."
              : loadError instanceof Error
                ? loadError.message
                : "Failed to load availability";
          setError(message);
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
  }, [isOpen, areaId]);

  const selectedDateAvailability = useMemo(() => {
    return availability?.dates.find((entry) => entry.date === date) ?? null;
  }, [availability, date]);

  const availableStartTimes = useMemo(() => {
    if (!selectedDateAvailability) {
      return [];
    }

    return selectedDateAvailability.slots
      .filter((slot) => slot.isOpen && slot.remainingCapacity >= selectedPeople)
      .map((slot) => slot.time);
  }, [selectedDateAvailability, selectedPeople]);

  const availableEndTimes = useMemo(() => {
    if (!selectedDateAvailability || !startTime) {
      return [];
    }

    const startIndex = selectedDateAvailability.slots.findIndex((slot) => slot.time === startTime);
    if (startIndex === -1) {
      return [];
    }

    const endTimes: string[] = [];

    for (let index = startIndex; index < selectedDateAvailability.slots.length; index += 1) {
      const slot = selectedDateAvailability.slots[index];
      if (!slot.isOpen || slot.remainingCapacity < selectedPeople) {
        break;
      }

      endTimes.push(addMinutesToTime(slot.time, 30));
    }

    return endTimes;
  }, [selectedDateAvailability, startTime, selectedPeople]);

  useEffect(() => {
    if (startTime && !availableStartTimes.includes(startTime)) {
      setStartTime("");
      setEndTime("");
    }
  }, [availableStartTimes, startTime]);

  useEffect(() => {
    if (endTime && !availableEndTimes.includes(endTime)) {
      setEndTime("");
    }
  }, [availableEndTimes, endTime]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAuthenticated || !token) {
      setError("Please log in before making a reservation.");
      return;
    }

    if (!areaId || !date || !startTime || !endTime) {
      setError("Please choose a valid reservation time range.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const endpoint = API_BASE_URL ? API_BASE_URL + "/api/reservations" : "/api/reservations";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          areaId,
          startTime: toIsoDateTime(date, startTime),
          endTime: toIsoDateTime(date, endTime),
          participantCount: selectedPeople,
          purpose: purpose.trim() || `${resourceName} reservation`,
          plannedItems: parsePlannedItems(plannedItemsInput),
          when2meet: when2meet.trim(),
          project: projectNotes.trim(),
        }),
      });

      if (response.status === 401) {
        logout();
        throw new Error("Your session expired. Please log in again.");
      }

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setIsSuccess(true);
      onReservationCreated?.();
      window.setTimeout(() => {
        onClose();
      }, 1600);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Reservation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSlotClick = (day: AvailabilityDate, slot: AvailabilitySlot) => {
    if (!slot.isOpen || slot.remainingCapacity < selectedPeople) {
      return;
    }

    const clickedEndTime = addMinutesToTime(slot.time, 30);

    if (date !== day.date || !startTime) {
      setDate(day.date);
      setStartTime(slot.time);
      setEndTime(clickedEndTime);
      return;
    }

    if (slot.time < startTime) {
      setDate(day.date);
      setStartTime(slot.time);
      setEndTime(clickedEndTime);
      return;
    }

    if (availableEndTimes.includes(clickedEndTime)) {
      setDate(day.date);
      setEndTime(clickedEndTime);
      return;
    }

    setDate(day.date);
    setStartTime(slot.time);
    setEndTime(clickedEndTime);
  };

  const submitDisabled = !isAuthenticated || loading || submitting || !date || !startTime || !endTime;

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
      <div className="relative my-auto w-full max-w-5xl max-h-[calc(100vh-2rem)] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-full md:w-2/5 p-8 border-b md:border-b-0 md:border-r border-slate-700/50 bg-slate-900/50 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-100 mb-1">Reserve Space</h2>
            <p className="text-sm text-emerald-400 font-medium tracking-wide">{resourceName}</p>
          </div>

          {isSuccess ? (
              <div className="flex flex-col items-center justify-center h-64 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">Reservation Submitted</h3>
              <p className="text-sm text-slate-400 mt-2">Your booking is saved and waiting for admin review.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isAuthenticated ? (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                  <div className="font-medium">Login required</div>
                  <div className="mt-1 text-sky-100/80">You can browse availability first, but only signed-in users can submit reservations.</div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate("/login");
                    }}
                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-100 hover:bg-sky-400/20"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Go to Login
                  </button>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  {error}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  Select Date
                </label>
                <div className="relative">
                  <select
                    required
                    disabled={loading || !availability}
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setStartTime("");
                      setEndTime("");
                    }}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>
                      {loading ? "Loading availability..." : "Select next 5 non-weekend days..."}
                    </option>
                    {availability?.dates.map((entry) => (
                      <option key={entry.date} value={entry.date}>
                        {entry.display} ({entry.dayLabel})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Reservation Duration
                </label>
                <p className="text-xs text-slate-500">
                  Click a start slot, then click a later free slot on the same day to extend the reservation.
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 pl-1">Start Time</span>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Clock className={(!date ? "text-slate-700" : "text-slate-500") + " w-3.5 h-3.5"} />
                      </div>
                      <select
                        required
                        disabled={!date}
                        value={startTime}
                        onChange={(event) => {
                          setStartTime(event.target.value);
                          setEndTime("");
                        }}
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="" disabled>--:--</option>
                        {availableStartTimes.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className={(!date ? "text-slate-700" : "text-slate-500") + " w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-500 font-medium pt-5">-</span>
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 pl-1">End Time</span>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Clock className={(!startTime ? "text-slate-700" : "text-slate-500") + " w-3.5 h-3.5"} />
                      </div>
                      <select
                        required
                        disabled={!startTime}
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="" disabled>--:--</option>
                        {availableEndTimes.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className={(!startTime ? "text-slate-700" : "text-slate-500") + " w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-slate-500" />
                  Number of People
                  <span className="text-xs text-slate-500 font-normal ml-auto">Max capacity: {effectiveMaxCapacity}</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={effectiveMaxCapacity}
                  required
                  value={people}
                  onChange={(event) => {
                    const nextValue = Number.parseInt(event.target.value, 10);
                    if (!Number.isNaN(nextValue) && nextValue > effectiveMaxCapacity) {
                      setPeople(String(effectiveMaxCapacity));
                    } else {
                      setPeople(event.target.value);
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Purpose</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  placeholder="Purpose of use"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
                <p className="text-xs text-slate-500">Purpose of use</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Planned Items</label>
                <textarea
                  rows={4}
                  value={plannedItemsInput}
                  onChange={(event) => setPlannedItemsInput(event.target.value)}
                  placeholder={"One item per line\nArduino series\nESP series\nBreadboard"}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-y"
                />
                <p className="text-xs text-slate-500">
                  Optional list of items or equipment the user plans to use.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Project</label>
                <textarea
                  rows={3}
                  value={projectNotes}
                  onChange={(event) => setProjectNotes(event.target.value)}
                  placeholder="Optional project name or project description"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">When2meet</label>
                <input
                  type="url"
                  value={when2meet}
                  onChange={(event) => setWhen2meet(event.target.value)}
                  placeholder="Optional scheduling reference or when2meet link"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitDisabled}
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                >
                  {submitting ? "Saving Reservation..." : isAuthenticated ? "Confirm Reservation" : "Log In to Reserve"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="w-full md:w-3/5 p-8 bg-slate-950 flex flex-col min-h-[420px] md:min-h-0 md:h-[500px]">
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Availability Overview</h3>
            <div className="flex items-center gap-4 text-xs font-medium flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-slate-800 border border-slate-700"></div>
                <span className="text-slate-500">Free</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-slate-950 border border-slate-700"></div>
                <span className="text-slate-500">Closed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/50"></div>
                <span className="text-emerald-400">Your Selection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-rose-500/20 border border-rose-500/50"></div>
                <span className="text-rose-400">Full</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar pr-2">
            <div className="min-w-max">
              <div className="flex">
                <div className="w-16 shrink-0"></div>
                {availability?.dates.map((day) => (
                  <div key={day.date} className="w-20 flex flex-col items-center justify-center text-xs font-semibold text-slate-500 py-1">
                    <span>{day.dayLabel}</span>
                    <span className="text-[10px] text-slate-600 font-medium">{day.display}</span>
                  </div>
                ))}
              </div>

              {gridSlots.map((slotTime) => (
                <div key={slotTime} className="flex group">
                  <div className="w-16 shrink-0 text-right pr-4 py-1 text-[10px] font-medium text-slate-500 self-center group-hover:text-slate-300 transition-colors">
                    {slotTime}
                  </div>
                  {availability?.dates.map((day) => {
                    const slot = day.slots.find((entry) => entry.time === slotTime);
                    if (!slot) {
                      return <div key={day.date + "-" + slotTime} className="w-20 h-8 border border-slate-800/50 m-[1px] rounded-sm bg-slate-950/80" />;
                    }

                    const isSelected = date === day.date && startTime !== "" && endTime !== "" && slotTime >= startTime && slotTime < endTime;
                    const isClickable = slot.isOpen && slot.remainingCapacity >= selectedPeople;
                    const title = !slot.isOpen
                      ? "Closed"
                      : slot.remainingCapacity < selectedPeople
                        ? "Only " + slot.remainingCapacity + " spot(s) remaining"
                        : slot.hasReservation
                          ? String(slot.occupiedCount) + " in use, " + String(slot.remainingCapacity) + " remaining"
                          : "Free";
                    const classNames = [
                      "w-20 h-8 border m-[1px] rounded-sm transition-colors text-left",
                      !slot.isOpen ? "bg-slate-950 border-slate-800 cursor-not-allowed" : "",
                      slot.isOpen && slot.remainingCapacity < selectedPeople ? "bg-rose-500/10 border-rose-500/20 cursor-not-allowed" : "",
                      slot.isOpen && slot.remainingCapacity >= selectedPeople && !isSelected ? "bg-slate-900/40 hover:bg-slate-800 border-slate-800/50 cursor-pointer" : "",
                      isSelected ? "bg-emerald-500/30 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "",
                    ].filter(Boolean).join(" ");

                    return (
                      <button
                        key={day.date + "-" + slotTime}
                        type="button"
                        onClick={() => handleSlotClick(day, slot)}
                        disabled={!isClickable}
                        title={title}
                        className={classNames}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
