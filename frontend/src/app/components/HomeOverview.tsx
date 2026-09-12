import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Clock3, Printer, RefreshCw, Scissors, UserRound } from "lucide-react";
import { Link } from "react-router";
import { apiUrl, readApi } from "../api";
import type { FabricationJob, ServiceType } from "../fabricationTypes";
import { formatMinutes } from "../fabricationTypes";

interface PublicReservation {
  id: string;
  userName: string;
  purpose: string;
  status: string;
  startTime: string;
  endTime: string;
  participantCount: number;
}

interface PublicSlot {
  time: string;
  endTime: string;
  isOpen: boolean;
  occupiedCount: number;
  remainingCapacity: number;
  isFull: boolean;
  hasReservation: boolean;
  reservationIds: string[];
}

interface PublicSchedule {
  area: { id: string; name: string; maxCapacity: number };
  dates: Array<{ date: string; dayLabel: string; display: string; slots: PublicSlot[] }>;
  reservations: PublicReservation[];
}

interface OperationsSnapshot {
  generatedAt: string;
  queues: Record<ServiceType, FabricationJob[]>;
  machines: Array<{ serviceType: ServiceType; name: string; status: string; serviceOpen: boolean; note: string }>;
}

const statusLabels: Record<string, string> = {
  pending: "等待審核",
  approved: "已核准",
  check_in_pending: "已報到",
  in_use: "使用中",
};

function getDurationMinutes(startTime: string, endTime: string) {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function PublicScheduleView({ schedule }: { schedule: PublicSchedule }) {
  const [selectedReservationIds, setSelectedReservationIds] = useState<string[]>([]);

  useEffect(() => {
    const clearSelectionOutsideReservation = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-public-reservation-slot="true"]')) return;
      setSelectedReservationIds([]);
    };

    document.addEventListener("pointerdown", clearSelectionOutsideReservation, true);
    return () => document.removeEventListener("pointerdown", clearSelectionOutsideReservation, true);
  }, []);

  const gridRows = useMemo(() => {
    const rows = new Map<string, { time: string; endTime: string }>();
    for (const day of schedule.dates) {
      for (const slot of day.slots) {
        if (!rows.has(slot.time)) rows.set(slot.time, { time: slot.time, endTime: slot.endTime });
      }
    }
    return [...rows.values()].sort((left, right) => left.time.localeCompare(right.time));
  }, [schedule]);

  const selectedReservations = useMemo(
    () => schedule.reservations.filter((item) => selectedReservationIds.includes(item.id)),
    [schedule.reservations, selectedReservationIds]
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-100">
            <CalendarDays className="w-5 h-5 text-emerald-400" />
            {schedule.area.name} 公開時間表
          </h2>
          <p className="mt-1 text-sm text-slate-400">僅供查看。點選有預約的時段，可查看借用人與用途。</p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-sm text-slate-400">
          最多 {schedule.area.maxCapacity} 人
        </span>
      </header>

      <div className="min-h-[104px] border-b border-slate-800 bg-slate-950/35 px-5 py-4">
        {selectedReservations.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {selectedReservations.map((reservation) => (
              <article key={reservation.id} className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-100">
                    <UserRound className="w-4 h-4 text-cyan-300" />
                    {reservation.userName}
                  </div>
                  <span className="rounded-full border border-cyan-500/30 px-2 py-0.5 text-xs text-cyan-200">
                    {statusLabels[reservation.status] || reservation.status}
                  </span>
                </div>
                <p className="mt-2 text-base text-slate-200">{reservation.purpose}</p>
                <p className="mt-2 font-mono text-sm text-slate-400">
                  {formatDateTime(reservation.startTime)}–{formatDateTime(reservation.endTime)} · {reservation.participantCount} 人
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[70px] items-center justify-center text-sm text-slate-500">
            點選下方有預約的區塊後，這裡會顯示完整預約資訊。
          </div>
        )}
      </div>

      <div className="overflow-x-auto p-4 custom-scrollbar">
        <div className="min-w-[820px]">
          <div className="mb-2 flex border-b border-slate-800 pb-2">
            <div className="w-20 shrink-0 pr-3 text-right text-xs font-mono text-slate-500">時間</div>
            {schedule.dates.map((day) => (
              <div key={day.date} className="mx-1 flex-1 rounded-lg border border-slate-800 bg-slate-950/60 py-2 text-center">
                <div className="text-sm font-semibold text-slate-200">{day.dayLabel}</div>
                <div className="text-xs font-mono text-slate-500">{day.display}</div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            {gridRows.map((row) => {
              const height = Math.max(42, Math.round((44 * getDurationMinutes(row.time, row.endTime)) / 30));
              return (
                <div key={row.time} className="flex items-center">
                  <div style={{ height }} className="w-20 shrink-0 pr-3 flex flex-col items-end justify-center font-mono">
                    <span className="text-sm text-slate-300">{row.time}</span>
                    <span className="text-xs text-slate-600">{row.endTime}</span>
                  </div>
                  {schedule.dates.map((day) => {
                    const slot = day.slots.find((item) => item.time === row.time);
                    if (!slot) {
                      return <div key={`${day.date}-${row.time}`} style={{ height }} className="mx-1 flex-1 rounded-lg border border-slate-900 bg-slate-950/50" />;
                    }

                    const reservationIds = slot.reservationIds || [];
                    const isSelected = reservationIds.some((id) => selectedReservationIds.includes(id));
                    const isOccupied = reservationIds.length > 0;
                    const color = isSelected
                      ? "border-cyan-400 bg-cyan-500/25 text-cyan-100 ring-2 ring-cyan-400/60 shadow-[0_0_18px_rgba(34,211,238,.2)]"
                      : isOccupied
                        ? slot.isFull
                          ? "border-rose-500/45 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                        : "border-slate-800 bg-slate-900/45 text-slate-600";

                    return (
                      <button
                        key={`${day.date}-${slot.time}`}
                        type="button"
                        disabled={!isOccupied}
                        aria-pressed={isSelected}
                        data-public-reservation-slot={isOccupied ? "true" : undefined}
                        onClick={() => setSelectedReservationIds(reservationIds)}
                        style={{ height }}
                        className={`mx-1 flex-1 rounded-lg border px-2 transition-all ${color} ${isOccupied ? "cursor-pointer" : "cursor-default"}`}
                        title={isOccupied ? "查看此時段的借用資訊" : "此時段沒有預約"}
                      >
                        <span className="block text-sm font-medium">
                          {isOccupied ? (reservationIds.length > 1 ? `${reservationIds.length} 筆預約` : "已預約") : "可使用"}
                        </span>
                        {isOccupied && <span className="mt-0.5 block text-xs opacity-75">{slot.occupiedCount} 人</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function MachineCard({ type, snapshot }: { type: ServiceType; snapshot: OperationsSnapshot }) {
  const machine = snapshot.machines.find((item) => item.serviceType === type);
  const runningJob = (snapshot.queues[type] || []).find((item) => item.status === "running");
  const isRunning = Boolean(runningJob) || machine?.status === "running";
  const Icon = type === "3dp" ? Printer : Scissors;

  return (
    <section className={`rounded-2xl border p-5 ${isRunning ? "border-emerald-500/45 bg-emerald-500/10" : "border-slate-800 bg-slate-900/50"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl border p-3 ${isRunning ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300" : "border-slate-700 bg-slate-950 text-slate-400"}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">{type === "3dp" ? "3DP · Bambu P1S" : "雷射切割機"}</h2>
            <p className="mt-1 text-sm text-slate-500">{machine?.name || "Machine"}</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-sm font-mono ${isRunning ? "border-emerald-500/40 text-emerald-300" : machine?.serviceOpen === false ? "border-rose-500/40 text-rose-300" : "border-slate-700 text-slate-400"}`}>
          {isRunning ? "執行中" : machine?.serviceOpen === false ? "暫停服務" : "目前閒置"}
        </span>
      </div>

      {runningJob ? (
        <div className="mt-5 rounded-xl border border-emerald-500/25 bg-slate-950/45 p-4">
          <div className="text-xs font-mono text-emerald-300">CURRENT JOB</div>
          <h3 className="mt-1 text-lg font-medium text-slate-100">{runningJob.title}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {runningJob.user?.name || "Maker"} · {formatMinutes(runningJob.estimatedMinutes)}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-300">
            <Clock3 className="w-4 h-4" />
            {runningJob.expectedEndAt ? `預計 ${formatDateTime(runningJob.expectedEndAt)} 完成` : "製作進行中"}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-center text-base text-slate-500">
          目前沒有正在執行的工作
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500">排隊中 {(snapshot.queues[type] || []).filter((item) => item.status === "queued").length} 件</span>
        <Link to={`/fabrication/${type}`} className="font-medium text-emerald-300 hover:text-emerald-200">
          前往{type === "3dp" ? " 3DP" : "雷切"} →
        </Link>
      </div>
    </section>
  );
}

export function HomeOverview() {
  const [schedule, setSchedule] = useState<PublicSchedule | null>(null);
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const load = useCallback(async () => {
    try {
      const [nextSchedule, nextSnapshot] = await Promise.all([
        readApi<PublicSchedule>(await fetch(apiUrl("/api/public/display/schedule"), { cache: "no-store" })),
        readApi<OperationsSnapshot>(await fetch(apiUrl("/api/public/display"), { cache: "no-store" })),
      ]);
      setSchedule(nextSchedule);
      setSnapshot(nextSnapshot);
      setLastUpdated(new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "首頁狀態載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-mono tracking-[.2em] text-emerald-400">MKS LIVE OVERVIEW</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-100">MakerSpace 使用總覽</h1>
          <p className="mt-2 text-base text-slate-400">查看空間預約與目前正在執行的加工工作。</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-mono text-slate-500">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {lastUpdated ? `更新於 ${lastUpdated}` : "讀取中"}
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {snapshot ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <MachineCard type="3dp" snapshot={snapshot} />
          <MachineCard type="laser" snapshot={snapshot} />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/40" />)}
        </div>
      )}

      {schedule ? (
        <PublicScheduleView schedule={schedule} />
      ) : (
        <div className="h-[560px] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/40" />
      )}
    </div>
  );
}
