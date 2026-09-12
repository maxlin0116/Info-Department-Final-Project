import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { Download, Loader2, PackageCheck, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { useAuth } from "../auth";
import { apiUrl, authHeaders, readApi } from "../api";
import type { FabricationJob, QuotaSummary } from "../fabricationTypes";
import { fabricationStatusLabel, formatDateTime, formatMinutes } from "../fabricationTypes";

const badge: Record<string, string> = {
  slicing: "text-sky-300 border-sky-500/30 bg-sky-500/10",
  slice_ready: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10",
  slice_failed: "text-rose-300 border-rose-500/30 bg-rose-500/10",
  pending_admin_estimate: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  pending_admin_review: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  queued: "text-violet-300 border-violet-500/30 bg-violet-500/10",
  running: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  completed: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10"
};

export function FabricationJobs() {
  const { token, isAuthenticated } = useAuth();
  const [jobs, setJobs] = useState<FabricationJob[]>([]);
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [jobData, quotaData] = await Promise.all([
        readApi<{ jobs: FabricationJob[] }>(await fetch(apiUrl("/api/fabrication/jobs/my"), { headers: authHeaders(token) })),
        readApi<{ quota: QuotaSummary }>(await fetch(apiUrl("/api/fabrication/quota/me"), { headers: authHeaders(token) }))
      ]);
      setJobs(jobData.jobs); setQuota(quotaData.quota); setError("");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "載入失敗"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); const timer = window.setInterval(load, 10000); return () => window.clearInterval(timer); }, [load]);
  if (!isAuthenticated || !token) return <Navigate to="/login" replace />;

  const action = async (job: FabricationJob, kind: "cancel" | "retry" | "collect") => {
    if (kind === "collect" && !window.confirm("確定這筆成品已經由使用者實體取走？")) return;
    const url = kind === "cancel"
      ? `/api/fabrication/jobs/${job.id}`
      : kind === "retry"
        ? `/api/fabrication/jobs/${job.id}/retry-slice`
        : `/api/fabrication/jobs/${job.id}/collect`;
    try {
      await readApi(await fetch(apiUrl(url), { method: kind === "cancel" ? "DELETE" : "POST", headers: authHeaders(token) }));
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "操作失敗"); }
  };

  const download = async (file: NonNullable<FabricationJob["outputFile"]>) => {
    const response = await fetch(apiUrl(file.downloadUrl || `/api/fabrication/files/${file.id}/download`), { headers: authHeaders(token) });
    if (!response.ok) return setError("檔案下載失敗");
    const href = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a"); anchor.href = href; anchor.download = file.originalFilename; anchor.click();
    URL.revokeObjectURL(href);
  };

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-mono text-emerald-400">FABRICATION_JOBS</p><h1 className="text-2xl font-mono text-slate-100 mt-1">我的加工工作</h1></div><button onClick={load} className="p-2 border border-slate-700 rounded-lg"><RefreshCw className="w-4 h-4" /></button></div>
    {quota && <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"><div className="flex justify-between text-sm"><span className="text-slate-300">3DP {quota.period} quota</span><span className="font-mono text-emerald-300">剩餘 {formatMinutes(quota.remainingMinutes)}</span></div><div className="h-2 mt-3 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, ((quota.consumedMinutes + quota.reservedMinutes) / quota.limitMinutes) * 100)}%` }} /></div><div className="flex gap-4 mt-2 text-xs text-slate-500"><span>已用 {formatMinutes(quota.consumedMinutes)}</span><span>排隊保留 {formatMinutes(quota.reservedMinutes)}</span><span>上限 {formatMinutes(quota.limitMinutes)}</span></div></div>}
    <div className="flex gap-3"><Link to="/fabrication/3dp" className="rounded-lg bg-sky-500/10 border border-sky-500/30 px-4 py-2 text-sm text-sky-200">新增 3DP</Link><Link to="/fabrication/laser" className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-sm text-amber-200">新增雷切</Link></div>
    {error && <p className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-rose-200">{error}</p>}
    {loading ? <Loader2 className="animate-spin text-slate-500" /> : jobs.length === 0 ? <div className="p-10 text-center border border-dashed border-slate-700 rounded-xl text-slate-500">尚無加工工作</div> : <div className="grid gap-4">{jobs.map((job) => <article key={job.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-semibold text-slate-100">{job.title}</h2><span className="text-[10px] font-mono uppercase text-slate-500">{job.serviceType}</span></div><p className="text-xs text-slate-500 mt-1">{job.sourceFile?.originalFilename} · {formatDateTime(job.createdAt)}</p></div><span className={`h-fit rounded-full border px-2.5 py-1 text-[10px] font-mono ${badge[job.status] || "text-slate-300 border-slate-700"}`}>{fabricationStatusLabel(job.status, job.collectedAt)}</span></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-sm"><div><span className="text-slate-500">預估</span><div className="text-slate-200">{formatMinutes(job.estimatedMinutes)}</div></div><div><span className="text-slate-500">總消耗克數</span><div className="text-slate-200">{job.filamentGrams != null ? `${job.filamentGrams.toFixed(1)} g` : "—"}</div></div><div><span className="text-slate-500">材料費</span><div className="font-semibold text-emerald-300">{job.materialFee != null ? `NT$ ${job.materialFee}` : "—"}</div></div><div><span className="text-slate-500">顏色</span><div className="text-slate-200">{job.assignedColor || job.requestedColor || "—"}</div></div><div><span className="text-slate-500">預計完成</span><div className="text-slate-200">{formatDateTime(job.expectedEndAt)}</div></div></div>
      {job.slicerError && <p className="mt-3 text-xs text-rose-300 break-words">{job.slicerError}</p>}{job.adminNote && <p className="mt-3 text-xs text-amber-200">管理員：{job.adminNote}</p>}
      <div className="flex flex-wrap gap-2 mt-4">{job.outputFile && <button onClick={() => download(job.outputFile!)} className="inline-flex gap-1.5 items-center text-xs px-3 py-1.5 rounded border border-slate-700"><Download className="w-3.5 h-3.5" />下載切片</button>}{job.status === "slice_failed" && <button onClick={() => action(job,"retry")} className="inline-flex gap-1.5 items-center text-xs px-3 py-1.5 rounded border border-sky-500/40 text-sky-200"><RotateCcw className="w-3.5 h-3.5" />重試切片</button>}{job.status === "completed" && !job.collectedAt && <button onClick={() => action(job,"collect")} className="inline-flex gap-1.5 items-center text-xs px-3 py-1.5 rounded border border-emerald-500/40 text-emerald-200"><PackageCheck className="w-3.5 h-3.5" />確認已取件</button>}{!["running","completed","cancelled","rejected","failed"].includes(job.status) && <button onClick={() => action(job,"cancel")} className="inline-flex gap-1.5 items-center text-xs px-3 py-1.5 rounded border border-rose-500/40 text-rose-200"><XCircle className="w-3.5 h-3.5" />取消</button>}</div>
    </article>)}</div>}
  </div>;
}
