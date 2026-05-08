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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ReservationModal } from "./ReservationModal";
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

function AreaCard({ item, onReserve }: { item: AreaStatusItem; onReserve: (area: AreaSummary) => void }) {
  const status = getAreaStatusKind(item);
  const { icon: Icon, eyebrow } = getAreaMeta(item.area.type);

  return (
    <div className={`relative p-5 rounded-xl border flex flex-col transition-all duration-300 ${getStatusColor(status)} group`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700 shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">{eyebrow}</p>
            <h3 className="font-semibold text-slate-100 truncate">{item.area.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{getAreaDetails(item)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium uppercase tracking-wider opacity-80 whitespace-nowrap">
            {getStatusLabel(status)}
          </span>
          <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusGlow(status)}`} />
        </div>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed mb-5">{item.area.description}</p>

      <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 mb-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-slate-500 uppercase tracking-widest text-[10px] mb-1">In Use</div>
          <div className="text-base font-semibold text-slate-100">
            {item.usedCount}/{item.area.maxCapacity}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-slate-500 uppercase tracking-widest text-[10px] mb-1">Remaining</div>
          <div className="text-base font-semibold text-slate-100">{item.remainingCapacity}</div>
        </div>
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-700/50 gap-3">
        <div className="text-xs text-slate-400">
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
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-all text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Reserve
        </button>
      </div>
    </div>
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
  const isAdmin = user?.role === "admin";

  const enrichedReservations = useMemo(() => {
    const now = new Date();
    return myReservations.map((reservation) => ({
      ...reservation,
      derivedStatus: getReservationStatusLabel(reservation, now),
      canCancel: canCancelReservation(reservation, now, isAdmin),
      cancelHint: getCancelHint(reservation, now, isAdmin),
    }));
  }, [myReservations, isAdmin]);

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
            }).format(new Date())
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
          const message =
            loadError instanceof Error ? loadError.message : "Failed to load your reservations";
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
      setReservationActionError(
        actionError instanceof Error ? actionError.message : "Failed to cancel reservation"
      );
    } finally {
      setActingReservationId(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Area Status</h1>
            <p className="text-sm text-slate-400 mt-1">
              Live availability is now driven by the backend reservation data.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{lastUpdated ? `Updated ${lastUpdated}` : "Fetching latest status..."}</span>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Could not load live area status</div>
              <div className="text-amber-100/80 mt-1">{error}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">My Reservations</h2>
            <p className="text-sm text-slate-400 mt-1">
              Track your upcoming, active, and completed bookings.
            </p>
          </div>
          <CalendarClock className="w-5 h-5 text-slate-500 shrink-0" />
        </div>

        {!isAuthenticated ? (
          <div className="px-5 py-6 text-sm text-slate-400">
            <span>Log in to view your reservation status. </span>
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
              Go to login
            </Link>
          </div>
        ) : loadingReservations ? (
          <div className="px-5 py-6 text-sm text-slate-400">Loading your reservations...</div>
        ) : reservationsError ? (
          <div className="px-5 py-6 text-sm text-amber-200 bg-amber-500/10 border-t border-amber-500/20">
            {reservationsError}
          </div>
        ) : enrichedReservations.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">
            You do not have any reservations yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {enrichedReservations.map((reservation) => (
              <div
                key={reservation.id}
                className="px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-100">{reservation.area.name}</h3>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${getReservationStatusClassName(
                        reservation.derivedStatus
                      )}`}
                    >
                      {reservation.derivedStatus}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {formatReservationDate(reservation.startTime)} - {formatReservationDate(reservation.endTime)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {reservation.participantCount} participant(s)
                    {reservation.purpose ? ` · ${reservation.purpose}` : ""}
                  </p>
                  {reservation.plannedItems.length > 0 ? (
                    <p className="text-xs text-slate-500 mt-1">
                      Items: {formatPlannedItems(reservation.plannedItems)}
                    </p>
                  ) : null}
                  {reservation.project ? (
                    <p className="text-xs text-slate-500 mt-1">
                      Notes: {reservation.project}
                    </p>
                  ) : null}
                  {reservation.when2meet ? (
                    <p className="text-xs text-slate-500 mt-1 break-all">
                      When2meet: {reservation.when2meet}
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-500 mt-1">{reservation.cancelHint}</p>
                </div>
                <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
                  <div className="text-xs text-slate-500">
                    Reservation ID: {reservation.id.slice(-8)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCancelReservation(reservation.id)}
                    disabled={!reservation.canCancel || actingReservationId === reservation.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={reservation.cancelHint}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {actingReservationId === reservation.id ? "Cancelling..." : "Cancel Reservation"}
                  </button>
                </div>
              </div>
            ))}
            {reservationActionError ? (
              <div className="px-5 py-4 text-sm text-amber-200 bg-amber-500/10 border-t border-amber-500/20">
                {reservationActionError}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-8 text-sm text-slate-400">
          Loading current area status...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {areas.map((item) => (
            <AreaCard key={item.area.id} item={item} onReserve={handleReserve} />
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
