import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertCircle,
  CalendarClock,
  Hammer,
  Plus,
  Printer,
  RefreshCw,
  Users,
  XCircle,
  Zap,
  History as HistoryIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ReservationModal } from "./ReservationModal";
import { ReservationHistory } from "./ReservationHistory";
import { useAuth } from "../auth";

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
}

interface AreaStatusItem {
  area: AreaSummary;
  usedCount: number;
  remainingCapacity: number;
  activeReservationCount: number;
  isFull: boolean;
  hasActivePrinting: boolean;
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
  status: "approved" | "pending" | "rejected" | "cancelled";
}

interface MyReservationsResponse {
  reservations: ReservationItem[];
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

  const startTime = new Date(reservation.startTime);
  const endTime = new Date(reservation.endTime);

  if (now < startTime) {
    return "Upcoming";
  }

  if (now >= startTime && now < endTime) {
    return "In Progress";
  }

  return "Completed";
};

const getReservationStatusClassName = (status: string) => {
  switch (status) {
    case "Upcoming":
      return "text-sky-300 bg-sky-500/10 border-sky-500/30";
    case "In Progress":
      return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
    case "Completed":
      return "text-slate-300 bg-slate-500/10 border-slate-500/30";
    case "Pending":
      return "text-amber-300 bg-amber-500/10 border-amber-500/30";
    case "Rejected":
      return "text-rose-300 bg-rose-500/10 border-rose-500/30";
    case "Cancelled":
      return "text-slate-400 bg-slate-800/70 border-slate-700";
    default:
      return "text-slate-300 bg-slate-500/10 border-slate-500/30";
  }
};

const canCancelReservation = (reservation: ReservationItem, now: Date, isAdmin: boolean) => {
  if (isAdmin) {
    return reservation.status !== "cancelled" && reservation.status !== "rejected";
  }

  if (reservation.status === "cancelled" || reservation.status === "rejected") {
    return false;
  }

  const startTime = new Date(reservation.startTime);
  const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilStart >= 6;
};

const getCancelHint = (reservation: ReservationItem, now: Date, isAdmin: boolean) => {
  if (isAdmin) {
    return "Admin can cancel this reservation.";
  }

  if (reservation.status === "cancelled") {
    return "This reservation is already cancelled.";
  }

  if (reservation.status === "rejected") {
    return "Rejected reservations cannot be cancelled.";
  }

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
      return { icon: Users, eyebrow: "Meeting & Collaboration" };
    case "soldering":
      return { icon: Hammer, eyebrow: "Electronics & Soldering" };
    case "3dp":
      return { icon: Printer, eyebrow: "3D Printing" };
    case "heavy_processing":
      return { icon: Zap, eyebrow: "Machining & Heavy Processing" };
  }
};

const getAreaStatusKind = (item: AreaStatusItem): Status => {
  if (!item.area.isActive) {
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
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

function AreaCard({
  item,
  onReserve,
  index,
}: {
  item: AreaStatusItem;
  onReserve: (area: AreaSummary) => void;
  index: number;
}) {
  const status = getAreaStatusKind(item);
  const { icon: Icon, eyebrow } = getAreaMeta(item.area.type);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      custom={index}
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : "hidden"}
      animate="visible"
      variants={cardVariants}
      whileHover={shouldReduceMotion ? {} : { y: -4, transition: { duration: 0.2 } }}
      className={`relative p-5 rounded-xl border flex flex-col transition-all duration-300 ${getStatusColor(
        status,
      )} group cursor-default h-full`}
    >
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-slate-900/50 border border-slate-700 shrink-0">
              <Icon className="w-3.5 h-3.5" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono leading-none truncate">
              {eyebrow}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 bg-slate-950/40 px-2 py-1 rounded-sm border border-slate-800/50">
            <div className={`w-1.5 h-1.5 rounded-full ${getStatusGlow(status)} ${shouldReduceMotion ? "" : "animate-pulse"}`} />
            <span className="text-[9px] font-bold uppercase tracking-tight opacity-70 whitespace-nowrap font-mono">
              {getStatusLabel(status)}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="font-bold text-slate-100 font-mono tracking-tight text-lg leading-tight">
            {item.area.name}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 font-mono opacity-80">{getAreaDetails(item)}</p>
        </div>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed mb-5">{item.area.description}</p>

      <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 mb-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-slate-500 uppercase tracking-widest text-[10px] mb-1 font-mono">In Use</div>
          <div className="text-base font-semibold text-slate-100 font-mono">
            {item.usedCount}/{item.area.maxCapacity}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-slate-500 uppercase tracking-widest text-[10px] mb-1 font-mono">Remaining</div>
          <div className="text-base font-semibold text-slate-100 font-mono">{item.remainingCapacity}</div>
        </div>
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-700/50 gap-3">
        <div className="text-xs text-slate-400 italic">
          {item.area.showPrintingStatus
            ? item.hasActivePrinting
              ? "Printer is active"
              : "Printer is idle"
            : item.isFull
              ? "Area is full"
              : "Area accepts reservations"}
        </div>
        <button
          onClick={() => onReserve(item.area)}
          disabled={!item.area.isActive}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-all text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Reserve
        </button>
      </div>
    </motion.div>
  );
}

export function Dashboard() {
  const { token, user, isAuthenticated } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<AreaSummary | null>(null);
  const [areas, setAreas] = useState<AreaStatusItem[]>([]);
  const [myReservations, setMyReservations] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [reservationActionError, setReservationActionError] = useState<string | null>(null);
  const [actingReservationId, setActingReservationId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const isAdmin = user?.role === "admin";
  const shouldReduceMotion = useReducedMotion();

  const enrichedReservations = useMemo(() => {
    const now = new Date();
    return myReservations.map((reservation) => ({
      ...reservation,
      derivedStatus: getReservationStatusLabel(reservation, now),
      canCancel: canCancelReservation(reservation, now, isAdmin),
      cancelHint: getCancelHint(reservation, now, isAdmin),
    }));
  }, [myReservations, isAdmin]);

  const activeReservations = useMemo(() => {
    return enrichedReservations.filter((r) => 
      r.derivedStatus !== "Completed" && 
      r.status !== "cancelled" && 
      r.status !== "rejected"
    );
  }, [enrichedReservations]);

  const handleReserve = (area: AreaSummary) => {
    setSelectedArea(area);
    setModalOpen(true);
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
      setReservationsError(null);
      setLoadingReservations(false);
      return;
    }

    let cancelled = false;

    const loadMyReservations = async () => {
      try {
        if (!cancelled) {
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
      }
    };

    void loadMyReservations();

    return () => {
      cancelled = true;
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

  if (showHistory) {
    return (
      <ReservationHistory
        reservations={enrichedReservations}
        loading={loadingReservations}
        error={reservationsError}
        onBack={() => setShowHistory(false)}
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(true)}
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
              onClick={() => setShowHistory(true)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-64 rounded-xl border border-slate-800 bg-slate-900/40 animate-pulse flex items-center justify-center"
            >
              <RefreshCw className="w-6 h-6 text-slate-700 animate-spin" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {areas.map((item, index) => (
            <AreaCard key={item.area.id} item={item} onReserve={handleReserve} index={index} />
          ))}
        </div>
      )}

      <ReservationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        areaId={selectedArea?.id ?? null}
        resourceName={selectedArea?.name ?? ""}
        maxCapacity={selectedArea?.maxCapacity ?? 1}
        onReservationCreated={() => setRefreshNonce((current) => current + 1)}
      />
    </>
  );
}
