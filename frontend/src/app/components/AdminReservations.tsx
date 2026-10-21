import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router";
import { CheckCircle2, Clock3, ShieldAlert, ShieldCheck, UserCheck, UserX, XCircle } from "lucide-react";
import { useAuth } from "../auth";
import { useLanguage, translateAreaName, translateGrade } from "../i18n";

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

const formatReservationDate = (value: string, lang: "zh" | "en") =>
  new Intl.DateTimeFormat(lang === "zh" ? "zh-TW" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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
  const { lang, tx } = useLanguage();
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
          setError(loadError instanceof Error ? loadError.message : tx("無法載入待審核預約", "Failed to load pending reservations"));
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
  }, [isAuthenticated, token, isAdmin, tx]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-6 py-8 text-amber-100">
        <div className="flex items-center gap-3 mb-3">
          <ShieldAlert className="w-5 h-5" />
          <h1 className="text-lg font-semibold">{tx("需要管理員權限", "Admin access required")}</h1>
        </div>
        <p className="text-sm text-amber-100/80">
          {tx("您目前的帳號沒有審核預約的管理員權限。", "Your current account does not have administrator permissions for reservation review.")}
        </p>
      </div>
    );
  }

  const handleDecision = async (reservationId: string, action: "approve" | "reject" | "confirm-attendance" | "no-show") => {
    if (!token) {
      return;
    }
    if (action === "no-show" && !window.confirm(tx("確定使用者未實際到場？此操作會立即釋放預約容量。", "Are you sure the user did not show up? This action will immediately release reserved capacity."))) return;

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
      setActionError(decisionError instanceof Error ? decisionError.message : tx("更新預約狀態失敗", "Failed to update reservation status"));
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
            <h1 className="text-2xl font-semibold text-slate-100">{tx("空間預約審核與現場監控", "Admin Reservation Review")}</h1>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            {tx("審核空間借用申請，並確認報到使用者已實際到場使用空間。", "Review booking requests and verify that checked-in users are physically using the MakerSpace.")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-widest text-slate-500">{tx("待處理事項", "Action Required")}</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{pendingCount}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="text-sm font-medium text-slate-300">{tx("預約審核與報到現場管理", "Reservation & Attendance Operations")}</div>
          <Link to="/" className="text-sm text-emerald-400 hover:text-emerald-300">
            {tx("返回主控台", "Back to dashboard")}
          </Link>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-400">{tx("正在載入待處理預約...", "Loading pending reservations...")}</div>
        ) : error ? (
          <div className="px-5 py-6 text-sm text-amber-200 bg-amber-500/10 border-t border-amber-500/20">
            {error}
          </div>
        ) : reservations.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">{tx("目前沒有需要關注或審核的預約項目。", "No reservations currently require monitoring.")}</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {reservations.map((reservation) => (
              <div
                key={reservation.id}
                className="px-5 py-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-base font-semibold text-slate-100">{translateAreaName(reservation.area.name, lang)}</h2>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${reservation.status === "check_in_pending" ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" : reservation.status === "in_use" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : reservation.status === "approved" ? "border-sky-500/30 bg-sky-500/10 text-sky-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
                      {reservation.status === "check_in_pending" ? tx("待確認報到", "Check-in Pending") : reservation.status === "in_use" ? tx("使用中", "In Use") : reservation.status === "approved" ? tx("已核准／待報到", "Approved / Pending Check-in") : tx("等待審核", "Pending Review")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {formatReservationDate(reservation.startTime, lang)} - {formatReservationDate(reservation.endTime, lang)}
                  </p>
                  <p className="text-sm text-slate-400">
                    {reservation.user.name} ({reservation.user.studentId} · {translateGrade(reservation.user.grade, lang)}) · {reservation.participantCount} {tx("人", "participant(s)")}
                  </p>
                  <p className="text-sm text-slate-500">
                    {tx("用途：", "Purpose: ")}{reservation.purpose || tx("一般空間使用", "General MakerSpace use")}
                  </p>
                  {reservation.plannedItems.length > 0 ? (
                    <p className="text-sm text-slate-500">
                      {tx("預計設備／耗材：", "Items: ")}{formatPlannedItems(reservation.plannedItems)}
                    </p>
                  ) : null}
                  {reservation.project ? (
                    <p className="text-sm text-slate-500">
                      {tx("備註：", "Notes: ")}{reservation.project}
                    </p>
                  ) : null}
                  {reservation.when2meet ? (
                    <p className="text-sm text-slate-500 break-all">
                      When2meet: {reservation.when2meet}
                    </p>
                  ) : null}
                  {reservation.checkInRequestedAt ? (
                    <p className="text-sm text-cyan-300 flex items-center gap-2"><Clock3 className="w-4 h-4" />{tx(`使用者於 ${formatReservationDate(reservation.checkInRequestedAt, lang)} 提交報到`, `User submitted check-in at ${formatReservationDate(reservation.checkInRequestedAt, lang)}`)}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {reservation.status === "pending" ? <>
                    <button type="button" onClick={() => handleDecision(reservation.id, "reject")} disabled={actingReservationId === reservation.id} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-60 cursor-pointer"><XCircle className="w-4 h-4" />{tx("拒絕", "Reject")}</button>
                    <button type="button" onClick={() => handleDecision(reservation.id, "approve")} disabled={actingReservationId === reservation.id} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60 cursor-pointer"><CheckCircle2 className="w-4 h-4" />{tx("核准", "Approve")}</button>
                  </> : null}
                  {reservation.status === "check_in_pending" ? <>
                    <button type="button" onClick={() => handleDecision(reservation.id, "no-show")} disabled={actingReservationId === reservation.id} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-60 cursor-pointer"><UserX className="w-4 h-4" />{tx("未到場", "No-show")}</button>
                    <button type="button" onClick={() => handleDecision(reservation.id, "confirm-attendance")} disabled={actingReservationId === reservation.id} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60 cursor-pointer"><UserCheck className="w-4 h-4" />{tx("確認實際使用", "Confirm In-Use")}</button>
                  </> : null}
                  {reservation.status === "approved" && new Date() >= new Date(reservation.startTime) ? <button type="button" onClick={() => handleDecision(reservation.id, "no-show")} disabled={actingReservationId === reservation.id} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-60 cursor-pointer"><UserX className="w-4 h-4" />{tx("未到場", "No-show")}</button> : null}
                  {reservation.status === "in_use" ? <span className="inline-flex items-center gap-2 px-3 py-2 text-sm text-emerald-300"><UserCheck className="w-4 h-4" />{tx("已確認使用中", "Confirmed In-Use")}</span> : null}
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
