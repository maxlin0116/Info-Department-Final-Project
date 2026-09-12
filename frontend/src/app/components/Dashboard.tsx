import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  AlertCircle,
  CalendarClock,
  Gauge,
  Hammer,
  Plus,
  Printer,
  RefreshCw,
  Users,
  XCircle,
  Zap,
  History as HistoryIcon,
  LogIn,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ReservationModal } from "./ReservationModal";
import { ReservationHistory } from "./ReservationHistory";
import { useAuth } from "../auth";
import { QuotaInfo } from "./QuotaInfo";
import { AreaCardDeck } from "./AreaCardDeck";
import { ScheduleMatrixView } from "./ScheduleMatrixView";
import { InlineReservationForm } from "./InlineReservationForm";
import { AllAreasOverview } from "./AllAreasOverview";

type Status = "available" | "occupied" | "maintenance";
type AreaType = "meeting" | "soldering" | "3dp" | "heavy_processing";

interface AreaSummary {
  id: string;
  name: string;
  type: AreaType;
  maxCapacity: number;
  description: string;
  showPrintingStatus: boolean;
  isActive: boolean;
  bookingMode: "schedule" | "queue";
  serviceType: "meeting" | "soldering" | "3dp" | "laser";
}

interface AreaStatusItem {
  area: AreaSummary;
  usedCount: number;
  remainingCapacity: number;
  activeReservationCount: number;
  isFull: boolean;
  hasActivePrinting: boolean;
  queueLength?: number;
  machineStatus?: string;
  serviceOpen?: boolean;
}

interface AreaStatusResponse {
  statuses: AreaStatusItem[];
}

interface ReservationArea {
  id: string;
  name: string;
  type: AreaType;
}

interface PlannedItem {
  category: string;
  name: string;
  quantity: number;
}

interface ReservationItem {
  id: string;
  area: ReservationArea;
  participantCount: number;
  purpose: string;
  plannedItems: PlannedItem[];
  when2meet: string;
  project: string;
  startTime: string;
  endTime: string;
  status: "approved" | "pending" | "check_in_pending" | "in_use" | "completed" | "no_show" | "rejected" | "cancelled";
  checkInRequestedAt?: string | null;
  attendanceConfirmedAt?: string | null;
  noShowAt?: string | null;
  completedAt?: string | null;
  lifecycleReason?: string;
  checkInWindow?: { opensAt: string; closesAt: string; earlyMinutes: number; graceMinutes: number };
}

interface MyReservationsResponse {
  reservations: ReservationItem[];
  quota?: ReservationQuota;
}

interface ReservationQuota {
  limit: number;
  used: number;
  remaining: number;
  slotMinutes: number;
  activeReservationCount: number;
}

interface AreaMeta {
  icon: LucideIcon;
  eyebrow: string;
}

const AREA_STATUS_ENDPOINT = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/areas/status`
  : "/api/areas/status";
const MY_RESERVATIONS_ENDPOINT = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/reservations/my`
  : "/api/reservations/my";

const formatReservationDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const formatPlannedItems = (items: PlannedItem[]) =>
  items
    .filter((item) => item && item.name)
    .map((item) => `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}`)
    .join(", ");

async function readApiError(response: Response) {
  const text = await response.text();
  if (!text) {
    return `Request failed with status ${response.status}`;
  }

  try {
    const payload = JSON.parse(text) as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : `Request failed with status ${response.status}`;
  } catch {
    return text;
  }
}

const getReservationStatusLabel = (reservation: ReservationItem, now: Date) => {
  if (reservation.status === "cancelled") {
    return "Cancelled";
  }

  if (reservation.status === "rejected") {
    return "Rejected";
  }

  if (reservation.status === "pending") {
    return "Pending";
  }
  if (reservation.status === "check_in_pending") return "Check-in Pending";
  if (reservation.status === "in_use") return "In Use";
  if (reservation.status === "completed") return "Completed";
  if (reservation.status === "no_show") return "No-show";

  const startTime = new Date(reservation.startTime);
  const endTime = new Date(reservation.endTime);

  if (now < startTime) {
    return "Upcoming";
  }

  if (now >= startTime && now < endTime) {
    return "Awaiting Check-in";
  }

  return "Completed";
};

const getReservationStatusClassName = (status: string) => {
  switch (status) {
    case "Upcoming":
      return "text-sky-300 bg-sky-500/10 border-sky-500/30";
    case "In Progress":
    case "In Use":
      return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
    case "Check-in Pending":
      return "text-cyan-300 bg-cyan-500/10 border-cyan-500/30";
    case "Awaiting Check-in":
      return "text-violet-300 bg-violet-500/10 border-violet-500/30";
    case "Completed":
      return "text-slate-300 bg-slate-500/10 border-slate-500/30";
    case "Pending":
      return "text-amber-300 bg-amber-500/10 border-amber-500/30";
    case "Rejected":
      return "text-rose-300 bg-rose-500/10 border-rose-500/30";
    case "Cancelled":
      return "text-slate-400 bg-slate-800/70 border-slate-700";
    case "No-show":
      return "text-rose-300 bg-rose-500/10 border-rose-500/30";
    default:
      return "text-slate-300 bg-slate-500/10 border-slate-500/30";
  }
};

const canCancelReservation = (reservation: ReservationItem, now: Date, isAdmin: boolean) => {
  if (isAdmin) {
    return ["pending", "approved", "check_in_pending"].includes(reservation.status);
  }

  if (!["pending", "approved"].includes(reservation.status)) {
    return false;
  }

  const startTime = new Date(reservation.startTime);
  const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilStart >= 6;
};

const getCancelHint = (reservation: ReservationItem, now: Date, isAdmin: boolean) => {
  if (isAdmin) {
    return ["pending", "approved", "check_in_pending"].includes(reservation.status)
      ? "Admin can cancel this reservation."
      : "This reservation can no longer be cancelled.";
  }

  if (reservation.status === "cancelled") {
    return "This reservation is already cancelled.";
  }

  if (!["pending", "approved"].includes(reservation.status)) return "This reservation can no longer be cancelled.";

  const startTime = new Date(reservation.startTime);
  const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilStart < 6) {
    return "Reservations can only be cancelled at least 6 hours before the start time.";
  }

  return "You can cancel this reservation.";
};

const getStatusColor = (status: Status) => {
  switch (status) {
    case "available":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30 shadow-[0_0_15px_rgba(52,211,153,0.15)] ring-1 ring-emerald-400/20";
    case "occupied":
      return "text-rose-400 bg-rose-400/10 border-rose-400/30 shadow-[0_0_15px_rgba(251,113,133,0.15)] ring-1 ring-rose-400/20";
    case "maintenance":
      return "text-amber-400 bg-amber-400/10 border-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/20";
  }
};

const getStatusGlow = (status: Status) => {
  switch (status) {
    case "available":
      return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]";
    case "occupied":
      return "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]";
    case "maintenance":
      return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]";
  }
};

const getStatusLabel = (status: Status) => {
  switch (status) {
    case "available":
      return "Available";
    case "occupied":
      return "In Use";
    case "maintenance":
      return "Maintenance";
  }
};

const getAreaMeta = (type: AreaType): AreaMeta => {
  switch (type) {
    case "meeting":
      return { icon: Users, eyebrow: "MakerSpace General Access" };
    case "soldering":
      return { icon: Hammer, eyebrow: "Electronics & Soldering" };
    case "3dp":
      return { icon: Printer, eyebrow: "3D Printing" };
    case "heavy_processing":
      return { icon: Zap, eyebrow: "Machining & Heavy Processing" };
  }
};

const getAreaStatusKind = (item: AreaStatusItem): Status => {
  if (!item.area.isActive || item.serviceOpen === false || ["maintenance", "offline"].includes(item.machineStatus || "")) {
    return "maintenance";
  }

  if (item.isFull || item.hasActivePrinting) {
    return "occupied";
  }

  return "available";
};

const getAreaDetails = (item: AreaStatusItem) => {
  if (!item.area.isActive) {
    return "Temporarily unavailable";
  }

  if (item.area.bookingMode === "queue") {
    return `${item.machineStatus || "idle"} · ${item.queueLength || 0} job(s) waiting`;
  }

  if (item.area.showPrintingStatus) {
    return item.hasActivePrinting
      ? `Printing in progress · ${item.activeReservationCount} active job`
      : "No active print jobs";
  }

  return `${item.usedCount}/${item.area.maxCapacity} capacity currently reserved`;
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

function AreaQueueDetailView({ item }: { item: AreaStatusItem }) {
  const is3DP = item.area.type === "3dp";
  const { icon: Icon } = getAreaMeta(item.area.type);

  return (
    <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-cyan-400">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-slate-100">{item.area.name}</h2>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                Fabrication Queue
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{item.area.description}</p>
          </div>
        </div>

        <Link
          to={`/fabrication/${item.area.serviceType}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono text-xs font-semibold shadow-lg shadow-cyan-900/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          SUBMIT JOB & QUEUE
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Machine Status</div>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${item.hasActivePrinting ? "bg-emerald-400 animate-pulse" : "bg-cyan-400"}`} />
            <span className="text-sm font-semibold font-mono text-slate-200 capitalize">
              {item.machineStatus || (item.hasActivePrinting ? "Printing" : "Ready / Idle")}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Jobs in Queue</div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
            {item.queueLength ?? 0}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Estimated Turnaround</div>
          <div className="text-sm font-semibold font-mono text-slate-300 mt-2">
            {item.queueLength ? "~1 - 2 Work Days" : "Immediate / Low Queue"}
          </div>
        </div>
      </div>

      {/* Hardware Specs & Protocol */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-950/30 space-y-3">
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
            {is3DP ? "Hardware & Material Specs" : "Laser Specs & Materials"}
          </h3>
          <ul className="text-xs text-slate-400 space-y-2">
            {is3DP ? (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span><strong>Printers:</strong> Bambu Lab P1S High-Speed CoreXY</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span><strong>Multi-Color:</strong> Automatic Material System (AMS) 4-slots</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span><strong>Filaments:</strong> PLA, PETG, TPU (Engineering plastics require approval)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span><strong>Build Volume:</strong> 256 x 256 x 256 mm³</span>
                </li>
              </>
            ) : (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>Laser Unit:</strong> 80W CO2 Precision Laser Cutter</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>Supported Materials:</strong> Acrylic, Plywood, MDF, Leather, Cardboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span><strong>Strictly Prohibited:</strong> PVC, Vinyl, Metals, Carbon fiber (Toxic fumes)</span>
                </li>
              </>
            )}
          </ul>
        </div>

        <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-950/30 space-y-3">
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
            Submission & Execution Workflow
          </h3>
          <ol className="text-xs text-slate-400 space-y-2.5 list-decimal list-inside">
            <li>Slice your model with Bambu Studio (<code className="text-cyan-300 font-mono">.3mf</code>) or prepare vector drawings (<code className="text-amber-300 font-mono">.dxf/.svg</code>)</li>
            <li>Submit file via the portal with color/material specifications</li>
            <li>Administrator inspects print parameters and schedules execution</li>
            <li>Collect your completed fabrication when notified</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { token, user, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAreaId, setSelectedAreaId] = useState<string | "all">("all");
  const [isBooking, setIsBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<AreaSummary | null>(null);
  const [areas, setAreas] = useState<AreaStatusItem[]>([]);
  const [myReservations, setMyReservations] = useState<ReservationItem[]>([]);
  const [reservationQuota, setReservationQuota] = useState<ReservationQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [reservationActionError, setReservationActionError] = useState<string | null>(null);
  const [actingReservationId, setActingReservationId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const isAdmin = user?.role === "admin";
  const shouldReduceMotion = useReducedMotion();
  const showHistory = searchParams.get("view") === "history";

  const reservationAreas = useMemo(
    () => areas.filter((item) => item.area.bookingMode === "schedule"),
    [areas]
  );

  const selectedAreaItem = useMemo(() => {
    if (selectedAreaId === "all") return null;
    return reservationAreas.find((item) => item.area.id === selectedAreaId) || null;
  }, [reservationAreas, selectedAreaId]);

  const handleSelectArea = (areaId: string | "all") => {
    setSelectedAreaId(areaId);
    setIsBooking(false);
    setSelectedSlot(null);
  };

  const handleBookArea = (area: AreaSummary) => {
    setSelectedAreaId(area.id);
    setIsBooking(true);
    setSelectedSlot(null);
  };

  const handleSelectSlot = (slot: { date: string; startTime: string; endTime: string }) => {
    setSelectedSlot(slot);
    setIsBooking(true);
  };

  const enrichedReservations = useMemo(() => {
    return myReservations.map((reservation) => ({
      ...reservation,
      derivedStatus: getReservationStatusLabel(reservation, now),
      canCancel: canCancelReservation(reservation, now, isAdmin),
      cancelHint: getCancelHint(reservation, now, isAdmin),
    }));
  }, [myReservations, isAdmin, now]);

  const activeReservations = useMemo(() => {
    return enrichedReservations.filter((r) => 
      r.derivedStatus !== "Completed" && 
      r.status !== "cancelled" && 
      r.status !== "rejected" &&
      r.status !== "no_show" &&
      r.status !== "completed"
    );
  }, [enrichedReservations]);

  const quotaRemainingPercent = useMemo(() => {
    if (!reservationQuota || reservationQuota.limit <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((reservationQuota.remaining / reservationQuota.limit) * 100));
  }, [reservationQuota]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const handleReserve = (area: AreaSummary) => {
    setSelectedArea(area);
    setModalOpen(true);
  };

  const openHistory = () => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("view", "history");
    setSearchParams(nextSearchParams);
  };

  const closeHistory = () => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("view");
    setSearchParams(nextSearchParams);
  };

  useEffect(() => {
    let cancelled = false;

    const loadAreaStatuses = async () => {
      try {
        if (!cancelled) {
          setError(null);
        }

        const response = await fetch(AREA_STATUS_ENDPOINT);

        if (!response.ok) {
          throw new Error(`Area status request failed with ${response.status}`);
        }

        const payload = (await response.json()) as AreaStatusResponse;

        if (!Array.isArray(payload.statuses)) {
          throw new Error("Invalid area status response");
        }

        if (!cancelled) {
          setAreas(payload.statuses);
          setLastUpdated(
            new Intl.DateTimeFormat("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date()),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof TypeError
              ? "Cannot reach the backend API. Make sure the backend server is running on port 8000."
              : loadError instanceof Error
                ? loadError.message
                : "Failed to load area statuses";

          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAreaStatuses();
    const intervalId = window.setInterval(() => {
      void loadAreaStatuses();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshNonce]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setMyReservations([]);
      setReservationQuota(null);
      setReservationsError(null);
      setLoadingReservations(false);
      return;
    }

    let cancelled = false;
    let initialLoad = true;

    const loadMyReservations = async () => {
      try {
        if (!cancelled && initialLoad) {
          setLoadingReservations(true);
          setReservationsError(null);
        }

        const response = await fetch(MY_RESERVATIONS_ENDPOINT, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`My reservations request failed with ${response.status}`);
        }

        const payload = (await response.json()) as MyReservationsResponse;
        if (!Array.isArray(payload.reservations)) {
          throw new Error("Invalid reservations response");
        }

        if (!cancelled) {
          setMyReservations(payload.reservations);
          setReservationQuota(payload.quota ?? null);
          setReservationsError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load your reservations";
          setReservationsError(message);
        }
      } finally {
        if (!cancelled) {
          setLoadingReservations(false);
        }
        initialLoad = false;
      }
    };

    void loadMyReservations();
    const interval = window.setInterval(loadMyReservations, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isAuthenticated, token, refreshNonce]);

  const handleCancelReservation = async (reservationId: string) => {
    if (!token) {
      return;
    }

    try {
      setActingReservationId(reservationId);
      setReservationActionError(null);

      const endpoint = import.meta.env.VITE_API_BASE_URL
        ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/reservations/${reservationId}`
        : `/api/reservations/${reservationId}`;

      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setRefreshNonce((current) => current + 1);
    } catch (actionError) {
      setReservationActionError(actionError instanceof Error ? actionError.message : "Failed to cancel reservation");
    } finally {
      setActingReservationId(null);
    }
  };

  const handleCheckIn = async (reservationId: string) => {
    if (!token) return;
    try {
      setActingReservationId(reservationId);
      setReservationActionError(null);
      const endpoint = import.meta.env.VITE_API_BASE_URL
        ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/reservations/${reservationId}/check-in`
        : `/api/reservations/${reservationId}/check-in`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(await readApiError(response));
      setRefreshNonce((current) => current + 1);
    } catch (actionError) {
      setReservationActionError(actionError instanceof Error ? actionError.message : "Failed to check in");
    } finally {
      setActingReservationId(null);
    }
  };

  if (showHistory) {
    return (
      <ReservationHistory
        reservations={enrichedReservations}
        loading={loadingReservations}
        error={reservationsError}
        onBack={closeHistory}
      />
    );
  }

  return (
    <>
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 mb-6"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100 font-mono tracking-tight">Area Status</h1>
            <p className="text-sm text-slate-400 mt-1 font-sans">
              Live availability driven by terminal reservation data.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{lastUpdated ? `LAST_SYNC: ${lastUpdated}` : "WAITING_FOR_DATA..."}</span>
          </div>
        </div>

        <AnimatePresence>
          {error ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-start gap-3 overflow-hidden"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium font-mono uppercase tracking-wider text-xs">Error: Sync Failure</div>
                <div className="text-amber-100/80 mt-1 text-xs">{error}</div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800 bg-slate-900/20">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 font-mono">My Reservations</h2>
            <p className="text-sm text-slate-400 mt-1 font-sans">Track your active terminal sessions.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {reservationQuota ? (
              <div className="min-w-[190px] rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                <div className="flex items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest">
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                    Quota
                    <QuotaInfo />
                  </span>
                  <span className={reservationQuota.remaining === 0 ? "text-rose-300" : "text-slate-300"}>
                    {reservationQuota.remaining}/{reservationQuota.limit} LEFT
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${reservationQuota.remaining === 0 ? "bg-rose-400" : "bg-emerald-400"}`}
                    style={{ width: `${quotaRemainingPercent}%` }}
                  />
                </div>
                <div className="mt-1 text-[9px] text-slate-600 font-mono">
                  {reservationQuota.used}_USED · {reservationQuota.slotMinutes}MIN/PAX
                </div>
              </div>
            ) : null}
            <button
              onClick={openHistory}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-slate-100 hover:border-slate-500 transition-all cursor-pointer"
            >
              <HistoryIcon className="w-3.5 h-3.5" />
              VIEW_HISTORY
            </button>
            <CalendarClock className="w-5 h-5 text-slate-500 shrink-0" />
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="px-5 py-6 text-sm text-slate-400">
            <span>Log in to view your reservation status. </span>
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium font-mono">
              AUTH_LOGIN
            </Link>
          </div>
        ) : loadingReservations ? (
          <div className="px-5 py-6 text-sm text-slate-400 font-mono animate-pulse">READING_RESERVATIONS...</div>
        ) : reservationsError ? (
          <div className="px-5 py-6 text-sm text-amber-200 bg-amber-500/10 border-t border-amber-500/20 font-mono">
            {reservationsError}
          </div>
        ) : activeReservations.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 font-mono italic">
            NO_ACTIVE_RESERVATIONS_FOUND
            <button 
              onClick={openHistory}
              className="block mx-auto mt-2 text-xs text-emerald-500/70 hover:text-emerald-400 underline"
            >
              CHECK_ARCHIVED_HISTORY
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            <AnimatePresence mode="popLayout">
              {activeReservations.map((reservation, i) => (
                <motion.div
                  key={reservation.id}
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                  className="px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-slate-800/20 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-100 font-mono tracking-tight">
                        {reservation.area.name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-mono font-medium tracking-tighter uppercase ${getReservationStatusClassName(
                          reservation.derivedStatus,
                        )}`}
                      >
                        {reservation.derivedStatus}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1 font-mono text-[13px]">
                      {formatReservationDate(reservation.startTime)} - {formatReservationDate(reservation.endTime)}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      <p className="text-xs text-slate-500">
                        <Users className="w-3 h-3 inline mr-1 opacity-50" />
                        {reservation.participantCount} pax
                      </p>
                      {reservation.purpose && <p className="text-xs text-slate-500 italic">"{reservation.purpose}"</p>}
                    </div>
                    {reservation.plannedItems.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <span className="text-[10px] font-mono uppercase opacity-50">Tools:</span>
                        {formatPlannedItems(reservation.plannedItems)}
                      </p>
                    )}
                    <p className="text-xs text-slate-600 mt-1 font-mono text-[10px]">{reservation.cancelHint}</p>
                  </div>
                  <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
                    <div className="text-[10px] text-slate-600 font-mono">ID: {reservation.id.slice(-8)}</div>
                    {reservation.status === "approved" && reservation.checkInWindow && now >= new Date(reservation.checkInWindow.opensAt) && now <= new Date(reservation.checkInWindow.closesAt) && now < new Date(reservation.endTime) ? (
                      <button
                        type="button"
                        onClick={() => handleCheckIn(reservation.id)}
                        disabled={actingReservationId === reservation.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-mono font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50 cursor-pointer transition-all"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        {actingReservationId === reservation.id ? "CHECKING_IN..." : "CHECK_IN"}
                      </button>
                    ) : null}
                    {reservation.status === "check_in_pending" ? <p className="max-w-[220px] text-right text-[10px] text-cyan-300 font-mono">已報到，請等待管理員確認實際使用</p> : null}
                    <button
                      type="button"
                      onClick={() => handleCancelReservation(reservation.id)}
                      disabled={!reservation.canCancel || actingReservationId === reservation.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-mono font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                      title={reservation.cancelHint}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {actingReservationId === reservation.id ? "CANCEL_PENDING..." : "CANCEL_RSVN"}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <AnimatePresence>
              {reservationActionError ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-5 py-4 text-xs text-amber-200 bg-amber-500/10 border-t border-amber-500/20 font-mono overflow-hidden"
                >
                  ERROR: {reservationActionError}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {loading ? (
        <div className="flex flex-col lg:flex-row gap-6 items-stretch min-h-[600px]">
          <div className="w-full lg:w-[340px] xl:w-[360px] h-[550px] rounded-2xl border border-slate-800 bg-slate-900/30 animate-pulse flex flex-col items-center justify-center p-6 text-slate-600 font-mono text-xs gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
            <span>SYNCING_AREAS...</span>
          </div>
          <div className="flex-1 h-[550px] rounded-2xl border border-slate-800 bg-slate-900/30 animate-pulse flex flex-col items-center justify-center p-6 text-slate-600 font-mono text-xs gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
            <span>CALENDAR_MATRIX_LOADING...</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-stretch min-h-[640px]">
          {/* Left Column: Vertical Card Deck or Inline Reservation Form */}
          <div className="w-full lg:w-[340px] xl:w-[360px] shrink-0">
            <AnimatePresence mode="wait">
              {isBooking && selectedAreaItem?.area.bookingMode === "schedule" ? (
                <motion.div
                  key="booking-form"
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="h-full"
                >
                  <InlineReservationForm
                    areaId={selectedAreaItem.area.id}
                    areaName={selectedAreaItem.area.name}
                    maxCapacity={selectedAreaItem.area.maxCapacity}
                    initialDate={selectedSlot?.date}
                    initialStartTime={selectedSlot?.startTime}
                    initialEndTime={selectedSlot?.endTime}
                    quota={reservationQuota}
                    onBack={() => setIsBooking(false)}
                    onSuccess={() => {
                      setIsBooking(false);
                      setSelectedSlot(null);
                      setRefreshNonce((current) => current + 1);
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="card-deck"
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  className="h-full"
                >
                  <AreaCardDeck
                    areas={reservationAreas}
                    selectedAreaId={selectedAreaId}
                    onSelectArea={handleSelectArea}
                    onBookArea={handleBookArea}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Panoramic ALL overview, Schedule Matrix, or Queue Machine view */}
          <div className="flex-1 min-w-0">
            {selectedAreaId === "all" ? (
              <AllAreasOverview
                areas={reservationAreas}
                onSelectArea={handleSelectArea}
              />
            ) : selectedAreaItem?.area.bookingMode === "queue" ? (
              <AreaQueueDetailView item={selectedAreaItem} />
            ) : selectedAreaItem ? (
              <ScheduleMatrixView
                areaId={selectedAreaItem.area.id}
                areaName={selectedAreaItem.area.name}
                maxCapacity={selectedAreaItem.area.maxCapacity}
                selectedDate={selectedSlot?.date}
                selectedStartTime={selectedSlot?.startTime}
                selectedEndTime={selectedSlot?.endTime}
                onSelectSlot={handleSelectSlot}
                refreshNonce={refreshNonce}
              />
            ) : (
              <AllAreasOverview
                areas={reservationAreas}
                onSelectArea={handleSelectArea}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
