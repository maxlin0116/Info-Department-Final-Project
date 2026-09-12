import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router";
import { CheckCircle2, Clock3, ShieldAlert, ShieldCheck, UserCheck, UserX, XCircle } from "lucide-react";
import { useAuth } from "../auth";

type AreaType = "meeting" | "soldering" | "3dp" | "heavy_processing";
type ReservationStatus = "approved" | "pending" | "check_in_pending" | "in_use" | "completed" | "no_show" | "rejected" | "cancelled";

interface ReservationArea {
  id: string;
  name: string;
  type: AreaType;
}

interface ReservationUser {
  id: string;
  name: string;
  grade: string;
  studentId: string;
  personalEmail: string;
  role: string;
}

interface PlannedItem {
  category: string;
  name: string;
  quantity: number;
}

interface PendingReservation {
  id: string;
  user: ReservationUser;
  area: ReservationArea;
  participantCount: number;
  purpose: string;
  plannedItems: PlannedItem[];
  when2meet: string;
  project: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  checkInRequestedAt?: string | null;
  attendanceConfirmedAt?: string | null;
  lifecycleReason?: string;
}

interface PendingReservationsResponse {
  reservations: PendingReservation[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
  : "";

const PENDING_RESERVATIONS_ENDPOINT = API_BASE_URL
  ? `${API_BASE_URL}/api/admin/reservations/pending`
  : "/api/admin/reservations/pending";

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
    return typeof payload.error === "string"
      ? payload.error
      : `Request failed with status ${response.status}`;
  } catch {
    return text;
  }
}

export function AdminReservations() {
  const { token, user, isAuthenticated } = useAuth();
  const [reservations, setReservations] = useState<PendingReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingReservationId, setActingReservationId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const pendingCount = useMemo(
    () => reservations.filter((reservation) => ["pending", "check_in_pending"].includes(reservation.status)).length,
    [reservations]
  );

  useEffect(() => {
    if (!isAuthenticated || !token || !isAdmin) {
      setReservations([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let initialLoad = true;

    const loadPendingReservations = async () => {
      try {
        if (!cancelled && initialLoad) {
          setLoading(true);
          setError(null);
        }

        const response = await fetch(PENDING_RESERVATIONS_ENDPOINT, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const payload = (await response.json()) as PendingReservationsResponse;
        if (!Array.isArray(payload.reservations)) {
          throw new Error("Invalid pending reservations response");
        }

        if (!cancelled) {
          setReservations(payload.reservations);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load pending reservations");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
        initialLoad = false;
      }
    };

    void loadPendingReservations();
    const interval = window.setInterval(loadPendingReservations, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isAuthenticated, token, isAdmin]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-6 py-8 text-amber-100">
        <div className="flex items-center gap-3 mb-3">
          <ShieldAlert className="w-5 h-5" />
          <h1 className="text-lg font-semibold">Admin access required</h1>
        </div>
        <p className="text-sm text-amber-100/80">
          Your current account does not have administrator permissions for reservation review.
        </p>
      </div>
    );
  }

  const handleDecision = async (reservationId: string, action: "approve" | "reject" | "confirm-attendance" | "no-show") => {
    if (!token) {
      return;
    }
    if (action === "no-show" && !window.confirm("確定使用者未實際到場？此操作會立即釋放預約容量。")) return;

    try {
      setActingReservationId(reservationId);
      setActionError(null);

      const endpoint = API_BASE_URL
        ? `${API_BASE_URL}/api/admin/reservations/${reservationId}/${action}`
        : `/api/admin/reservations/${reservationId}/${action}`;

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const payload = await response.json() as { reservation?: PendingReservation };
      setReservations((current) => action === "confirm-attendance" && payload.reservation
        ? current.map((reservation) => reservation.id === reservationId ? payload.reservation! : reservation)
        : current.filter((reservation) => reservation.id !== reservationId));
    } catch (decisionError) {
      setActionError(decisionError instanceof Error ? decisionError.message : "Failed to update reservation status");
    } finally {
      setActingReservationId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-semibold text-slate-100">Admin Reservation Review</h1>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Review booking requests and verify that checked-in users are physically using the MakerSpace.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-widest text-slate-500">Action Required</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{pendingCount}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="text-sm font-medium text-slate-300">Reservation & Attendance Operations</div>
          <Link to="/" className="text-sm text-emerald-400 hover:text-emerald-300">
            Back to dashboard
          </Link>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-400">Loading pending reservations...</div>
        ) : error ? (
          <div className="px-5 py-6 text-sm text-amber-200 bg-amber-500/10 border-t border-amber-500/20">
            {error}
          </div>
        ) : reservations.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">No reservations currently require monitoring.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {reservations.map((reservation) => (
              <div
                key={reservation.id}
                className="px-5 py-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-base font-semibold text-slate-100">{reservation.area.name}</h2>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${reservation.status === "check_in_pending" ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" : reservation.status === "in_use" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : reservation.status === "approved" ? "border-sky-500/30 bg-sky-500/10 text-sky-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
                      {reservation.status === "check_in_pending" ? "待確認報到" : reservation.status === "in_use" ? "使用中" : reservation.status === "approved" ? "已核准／待報到" : "等待審核"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {formatReservationDate(reservation.startTime)} - {formatReservationDate(reservation.endTime)}
                  </p>
                  <p className="text-sm text-slate-400">
                    {reservation.user.name} ({reservation.user.studentId}) · {reservation.participantCount} participant(s)
                  </p>
                  <p className="text-sm text-slate-500">
                    Purpose: {reservation.purpose || "General MakerSpace use"}
                  </p>
                  {reservation.plannedItems.length > 0 ? (
                    <p className="text-sm text-slate-500">
                      Items: {formatPlannedItems(reservation.plannedItems)}
                    </p>
                  ) : null}
                  {reservation.project ? (
                    <p className="text-sm text-slate-500">
                      Notes: {reservation.project}
                    </p>
                  ) : null}
                  {reservation.when2meet ? (
                    <p className="text-sm text-slate-500 break-all">
                      When2meet: {reservation.when2meet}
                    </p>
                  ) : null}
                  {reservation.checkInRequestedAt ? (
                    <p className="text-sm text-cyan-300 flex items-center gap-2"><Clock3 className="w-4 h-4" />使用者於 {formatReservationDate(reservation.checkInRequestedAt)} 提交報到</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {reservation.status === "pending" ? <>
                    <button type="button" onClick={() => handleDecision(reservation.id, "reject")} disabled={actingReservationId === reservation.id} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"><XCircle className="w-4 h-4" />Reject</button>
                    <button type="button" onClick={() => handleDecision(reservation.id, "approve")} disabled={actingReservationId === reservation.id} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60"><CheckCircle2 className="w-4 h-4" />Approve</button>
                  </> : null}
                  {reservation.status === "check_in_pending" ? <>
                    <button type="button" onClick={() => handleDecision(reservation.id, "no-show")} disabled={actingReservationId === reservation.id} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"><UserX className="w-4 h-4" />No-show</button>
                    <button type="button" onClick={() => handleDecision(reservation.id, "confirm-attendance")} disabled={actingReservationId === reservation.id} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"><UserCheck className="w-4 h-4" />確認實際使用</button>
                  </> : null}
                  {reservation.status === "approved" && new Date() >= new Date(reservation.startTime) ? <button type="button" onClick={() => handleDecision(reservation.id, "no-show")} disabled={actingReservationId === reservation.id} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"><UserX className="w-4 h-4" />No-show</button> : null}
                  {reservation.status === "in_use" ? <span className="inline-flex items-center gap-2 px-3 py-2 text-sm text-emerald-300"><UserCheck className="w-4 h-4" />已確認使用中</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {actionError ? (
          <div className="px-5 py-4 border-t border-amber-500/20 bg-amber-500/10 text-sm text-amber-200">
            {actionError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
