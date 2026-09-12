import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Printer, Scissors, Users } from "lucide-react";
import { apiUrl, readApi } from "../api";
import type { FabricationJob, ServiceType } from "../fabricationTypes";
import { formatMinutes } from "../fabricationTypes";

interface Snapshot {
  generatedAt: string;
  reservations: Array<{ id: string; area: string; title: string; userName: string; status: string; startTime: string; endTime: string; participantCount: number; checkInRequestedAt?: string | null; attendanceConfirmedAt?: string | null; lifecycleReason?: string }>;
  queues: Record<ServiceType, FabricationJob[]>;
  machines: Array<{ serviceType: ServiceType; name: string; status: string; serviceOpen: boolean; note: string }>;
}

const timeOnly = (value: string | Date) => new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));

const attendanceLabel = (status: string) => ({
  pending: "等待審核",
  approved: "已核准・待報到",
  check_in_pending: "已報到・待管理員確認",
  in_use: "使用中",
  completed: "已完成",
  no_show: "未到場"
}[status] || status.toUpperCase());

const attendanceStyle = (status: string) => status === "in_use"
  ? "text-emerald-300"
  : status === "check_in_pending"
    ? "text-cyan-300"
    : status === "no_show"
      ? "text-rose-300"
      : status === "pending"
        ? "text-amber-300"
        : "text-sky-300";

export function PublicDisplay() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [now, setNow] = useState(new Date());
  const [connected, setConnected] = useState(false);

  const load = useCallback(async () => {
    try { setSnapshot(await readApi<Snapshot>(await fetch(apiUrl("/api/public/display"), { cache: "no-store" }))); } catch { setConnected(false); }
  }, []);

  useEffect(() => { void load(); const fallback = window.setInterval(load, 30000); const clock = window.setInterval(() => setNow(new Date()), 1000); const reload = window.setTimeout(() => window.location.reload(), 6 * 60 * 60 * 1000); return () => { window.clearInterval(fallback); window.clearInterval(clock); window.clearTimeout(reload); }; }, [load]);
  useEffect(() => { const stream = new EventSource(apiUrl("/api/public/display/stream")); stream.onopen = () => setConnected(true); stream.addEventListener("change", () => { setConnected(true); void load(); }); stream.onerror = () => setConnected(false); return () => stream.close(); }, [load]);

  const stale = !snapshot || Date.now() - new Date(snapshot.generatedAt).getTime() > 90000;
  const date = useMemo(() => new Intl.DateTimeFormat("zh-TW", { dateStyle: "full" }).format(now), [now]);

  return <main className="min-h-screen bg-[#020617] text-slate-100 p-6 lg:p-8 overflow-hidden">
    <header className="flex items-end justify-between gap-6 border-b border-slate-800 pb-5 mb-6"><div><p className="text-emerald-400 font-mono text-sm tracking-[.25em]">MKS LIVE OPERATIONS</p><h1 className="text-3xl lg:text-4xl font-semibold mt-2">空間預約與加工狀態</h1></div><div className="text-right"><div className="text-4xl lg:text-5xl font-mono tabular-nums">{timeOnly(now)}</div><div className="text-slate-400 mt-1">{date} · <span className={connected && !stale ? "text-emerald-400" : "text-amber-300"}>{connected && !stale ? "LIVE" : "RECONNECTING"}</span></div></div></header>
    {stale && <div className="mb-5 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-200"><AlertTriangle />目前顯示最後一次取得的資料，連線恢復後會自動更新。</div>}
    <div className="grid xl:grid-cols-[1.05fr_1fr_1fr] gap-5">
      <section className="display-panel"><div className="display-panel-title"><Users />今日 MKS 借用與報到</div><div className="space-y-3 overflow-y-auto max-h-[70vh]">{snapshot?.reservations.length ? snapshot.reservations.map((item) => { const active = item.status === "in_use"; return <div key={item.id} className={`rounded-xl border p-4 ${active ? "border-emerald-500/50 bg-emerald-500/10" : item.status === "check_in_pending" ? "border-cyan-500/40 bg-cyan-500/10" : item.status === "no_show" ? "border-rose-500/30 bg-rose-500/5" : "border-slate-700 bg-slate-950/50"}`}><div className="flex justify-between gap-4"><div><div className="text-xs font-mono text-slate-500">{item.area} · {item.userName}</div><h3 className="text-lg font-semibold mt-1">{item.title}</h3></div><span className={`text-xs font-mono text-right ${attendanceStyle(item.status)}`}>{attendanceLabel(item.status)}</span></div><div className="mt-3 text-slate-300 font-mono">{timeOnly(item.startTime)}–{timeOnly(item.endTime)} · {item.participantCount} 人</div>{item.status === "check_in_pending" ? <p className="mt-2 text-xs text-cyan-300">請管理員確認現場實際使用</p> : null}{item.status === "no_show" && item.lifecycleReason ? <p className="mt-2 text-xs text-rose-300/80">{item.lifecycleReason}</p> : null}</div>; }) : <Empty />}</div></section>
      {(["laser","3dp"] as ServiceType[]).map((type) => { const machine = snapshot?.machines.find((item) => item.serviceType === type); const jobs = snapshot?.queues[type] || []; return <section key={type} className="display-panel"><div className="display-panel-title">{type === "3dp" ? <Printer /> : <Scissors />}{type === "3dp" ? "P1S Queue" : "雷切 Queue"}<span className={`ml-auto text-xs ${machine?.status === "running" ? "text-emerald-300" : machine?.serviceOpen ? "text-sky-300" : "text-rose-300"}`}>{machine?.name} · {machine?.serviceOpen ? machine.status.toUpperCase() : "CLOSED"}</span></div><div className="space-y-3 overflow-y-auto max-h-[70vh]">{jobs.length ? jobs.map((job) => <div key={job.id} className={`rounded-xl border p-4 ${job.status === "running" ? "border-emerald-500/50 bg-emerald-500/10" : "border-slate-700 bg-slate-950/50"}`}><div className="flex gap-3"><div className="w-11 h-11 rounded-lg bg-slate-800 grid place-items-center font-mono">{job.status === "running" ? "RUN" : `#${job.position}`}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><h3 className="font-semibold truncate">{job.title}</h3><span className="font-mono text-slate-400">{formatMinutes(job.estimatedMinutes)}</span></div><p className="text-sm text-slate-500 mt-1">{job.user?.name || "Maker"}{job.assignedColor ? ` · ${job.assignedColor}` : ""}</p><p className="mt-2 flex items-center gap-1 text-xs text-slate-300"><Clock3 className="w-3.5 h-3.5" />{job.status === "running" ? `預計 ${job.expectedEndAt ? timeOnly(job.expectedEndAt) : "—"} 完成` : `預計 ${job.estimatedStartAt ? timeOnly(job.estimatedStartAt) : "—"} 開始`}</p></div></div></div>) : <Empty />}</div></section>; })}
    </div>
    <footer className="mt-5 flex justify-between text-xs font-mono text-slate-600"><span>PUBLIC DISPLAY · READ ONLY</span><span>LAST SYNC {snapshot ? timeOnly(snapshot.generatedAt) : "—"}</span></footer>
  </main>;
}

function Empty() { return <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-500">目前沒有項目</div>; }
