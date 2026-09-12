import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { Check, Download, PackageCheck, Play, RefreshCw, Save, Settings2, Square, XCircle } from "lucide-react";
import { useAuth } from "../auth";
import { apiUrl, authHeaders, readApi } from "../api";
import type { AmsSlot, FabricationConfig, FabricationJob } from "../fabricationTypes";
import { fabricationStatusLabel, formatDateTime, formatMinutes } from "../fabricationTypes";

interface Policy { serviceType: string; enabled: boolean; period: string; limitMinutes: number; maxActiveJobs: number }

export function AdminFabrication() {
  const { token, user, isAuthenticated } = useAuth();
  const [jobs, setJobs] = useState<FabricationJob[]>([]);
  const [config, setConfig] = useState<FabricationConfig | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [filter, setFilter] = useState("active");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [jobData, configData, policyData] = await Promise.all([
        readApi<{ jobs: FabricationJob[] }>(await fetch(apiUrl("/api/admin/fabrication/jobs"), { headers: authHeaders(token) })),
        readApi<{ config: FabricationConfig }>(await fetch(apiUrl("/api/fabrication/config"))),
        readApi<{ policies: Policy[] }>(await fetch(apiUrl("/api/admin/fabrication/quota"), { headers: authHeaders(token) }))
      ]);
      setJobs(jobData.jobs); setConfig(configData.config); setPolicies(policyData.policies); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "載入失敗"); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  if (!isAuthenticated || user?.role !== "admin" || !token) return <Navigate to="/login" replace />;

  const jobAction = async (job: FabricationJob, action: string) => {
    const data: Record<string, unknown> = { action };
    if (action === "collect" && !window.confirm("確定這筆成品已經由使用者實體取走？")) return;
    if (action === "estimate_laser") {
      const input = window.prompt("管理員確認的雷切加工分鐘數", String(job.estimatedMinutes || 30));
      if (!input) return; data.estimatedMinutes = Number(input);
      data.adminNote = window.prompt("估時備註（選填）", job.adminNote || "") || "";
    }
    if (action === "reject") data.reason = window.prompt("拒絕原因", "檔案或設定不符合規範") || "Rejected by administrator";
    if (action === "fail" || action === "complete") data.adminNote = window.prompt("完成／失敗備註（選填）", job.adminNote || "") || "";
    setBusy(job.id + action);
    try {
      await readApi(await fetch(apiUrl(`/api/admin/fabrication/jobs/${job.id}`), { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders(token) }, body: JSON.stringify(data) }));
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失敗"); }
    finally { setBusy(""); }
  };

  const updateJobColor = async (job: FabricationJob, slotNumber: number) => {
    const slot = config?.amsSlots.find((item) => item.slot === slotNumber);
    if (!slot) return;
    setBusy(job.id + "color");
    try {
      await readApi(await fetch(apiUrl(`/api/admin/fabrication/jobs/${job.id}`), { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders(token) }, body: JSON.stringify({ action: "update", assignedAmsSlot: slot.slot, assignedColor: slot.colorName }) }));
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "更新失敗"); }
    finally { setBusy(""); }
  };

  const saveConfig = async () => {
    if (!config) return;
    try {
      const result = await readApi<{ config: FabricationConfig }>(await fetch(apiUrl("/api/admin/fabrication/config"), { method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders(token) }, body: JSON.stringify(config) }));
      setConfig(result.config); setMessage("設備與 AMS 設定已儲存");
    } catch (error) { setMessage(error instanceof Error ? error.message : "儲存失敗"); }
  };

  const savePolicy = async (policy: Policy) => {
    try {
      await readApi(await fetch(apiUrl(`/api/admin/fabrication/quota/${policy.serviceType}`), { method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders(token) }, body: JSON.stringify(policy) }));
      setMessage("Quota policy 已儲存"); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "儲存失敗"); }
  };

  const download = async (job: FabricationJob, output = false) => {
    const file = output ? job.outputFile : job.sourceFile;
    if (!file) return;
    const response = await fetch(apiUrl(file.downloadUrl || `/api/fabrication/files/${file.id}/download`), { headers: authHeaders(token) });
    if (!response.ok) return setMessage("下載失敗");
    const href = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = href; anchor.download = file.originalFilename; anchor.click(); URL.revokeObjectURL(href);
  };

  const active = jobs.filter((job) => !["rejected","cancelled","failed"].includes(job.status) && !(job.status === "completed" && job.collectedAt));
  const visible = filter === "active" ? active : jobs;

  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-mono text-amber-400">ADMIN_FABRICATION</p><h1 className="text-2xl text-slate-100 font-mono mt-1">加工管理中心</h1></div><div className="flex gap-2"><Link to="/admin/reservations" className="px-3 py-2 border border-slate-700 rounded-lg text-xs">空間預約</Link><button onClick={load} className="p-2 border border-slate-700 rounded-lg"><RefreshCw className="w-4 h-4" /></button></div></div>
    {message && <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">{message}</div>}
    {config && <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-5"><div className="flex items-center justify-between"><h2 className="flex gap-2 font-mono text-slate-100"><Settings2 className="w-5 h-5 text-amber-400" />設備與 AMS</h2><button onClick={saveConfig} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-amber-500 text-slate-950 text-sm font-semibold"><Save className="w-4 h-4" />儲存</button></div>
      <div className="grid lg:grid-cols-2 gap-4">{config.machines.map((machine, index) => <div key={machine.serviceType} className="rounded-xl border border-slate-700 p-4"><div className="font-semibold text-slate-100">{machine.name}</div><div className="grid grid-cols-2 gap-3 mt-3"><select className="bg-slate-950 border border-slate-700 rounded p-2 text-sm" value={machine.status} onChange={(event) => setConfig({ ...config, machines: config.machines.map((item, itemIndex) => itemIndex === index ? { ...item, status: event.target.value } : item) })}><option value="idle">Idle</option><option value="running">Running</option><option value="maintenance">Maintenance</option><option value="offline">Offline</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={machine.serviceOpen} onChange={(event) => setConfig({ ...config, machines: config.machines.map((item, itemIndex) => itemIndex === index ? { ...item, serviceOpen: event.target.checked } : item) })} />接受新工作</label></div></div>)}</div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{config.amsSlots.map((slot, index) => <div key={slot.slot} className="rounded-xl border border-slate-700 p-3 space-y-2"><div className="text-xs font-mono text-slate-500">AMS SLOT {slot.slot}</div><div className="flex gap-2"><input type="color" value={slot.colorHex} onChange={(event) => setConfig({ ...config, amsSlots: config.amsSlots.map((item, i) => i === index ? { ...item, colorHex: event.target.value } : item) })} /><input className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded px-2 text-sm" value={slot.colorName} onChange={(event) => setConfig({ ...config, amsSlots: config.amsSlots.map((item, i) => i === index ? { ...item, colorName: event.target.value } : item) })} /></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={slot.available} onChange={(event) => setConfig({ ...config, amsSlots: config.amsSlots.map((item, i) => i === index ? { ...item, available: event.target.checked } : item) })} />可供選擇</label></div>)}</div>
    </section>}
    <section className="grid lg:grid-cols-2 gap-4">{policies.map((policy, index) => <div key={policy.serviceType} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"><h3 className="font-mono text-slate-100">{policy.serviceType.toUpperCase()} QUOTA</h3><div className="grid grid-cols-3 gap-2 mt-3"><select className="bg-slate-950 border border-slate-700 rounded p-2 text-sm" value={policy.period} onChange={(e) => setPolicies(policies.map((item,i) => i === index ? { ...item, period: e.target.value } : item))}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select><input type="number" className="bg-slate-950 border border-slate-700 rounded p-2 text-sm" value={policy.limitMinutes} onChange={(e) => setPolicies(policies.map((item,i) => i === index ? { ...item, limitMinutes: Number(e.target.value) } : item))} /><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={policy.enabled} onChange={(e) => setPolicies(policies.map((item,i) => i === index ? { ...item, enabled: e.target.checked } : item))} />啟用</label></div><button onClick={() => savePolicy(policy)} className="mt-3 text-xs text-emerald-300">SAVE_POLICY</button></div>)}</section>
    <section><div className="flex items-center justify-between mb-3"><h2 className="font-mono text-slate-100">工作佇列與審核 ({active.length})</h2><select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-xs"><option value="active">Active</option><option value="all">All</option></select></div><div className="space-y-3">{visible.map((job) => <article key={job.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-slate-100">{job.title} <span className="text-xs text-slate-500">· {job.serviceType}</span></h3><p className="text-xs text-slate-500 mt-1">{job.user?.name} · {job.sourceFile?.originalFilename} · {formatDateTime(job.createdAt)}</p></div><span className="text-xs font-mono text-amber-300">{fabricationStatusLabel(job.status, job.collectedAt)}</span></div><div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4 text-sm"><div><span className="text-slate-500">預估</span><div>{formatMinutes(job.estimatedMinutes)}</div></div><div><span className="text-slate-500">總消耗克數</span><div>{job.filamentGrams != null ? `${job.filamentGrams.toFixed(1)} g` : "—"}</div></div><div><span className="text-slate-500">材料費</span><div className="font-semibold text-emerald-300">{job.materialFee != null ? `NT$ ${job.materialFee}` : "—"}</div></div><div><span className="text-slate-500">材料</span><div>{job.material || "—"}</div></div><div><span className="text-slate-500">顏色</span><div>{job.assignedColor || "—"}</div></div><div><span className="text-slate-500">預計完成</span><div>{formatDateTime(job.expectedEndAt)}</div></div></div>
      {job.serviceType === "3dp" && config && <select value={job.assignedAmsSlot || ""} onChange={(e) => updateJobColor(job, Number(e.target.value))} className="mt-3 bg-slate-950 border border-slate-700 rounded p-2 text-xs"><option value="">AMS 槽位</option>{config.amsSlots.map((slot) => <option key={slot.slot} value={slot.slot}>{slot.slot} · {slot.colorName}</option>)}</select>}
      <div className="flex flex-wrap gap-2 mt-4"><button onClick={() => download(job)} className="admin-action"><Download />來源檔</button>{job.outputFile && <button onClick={() => download(job,true)} className="admin-action"><Download />G-code 3MF</button>}{job.status === "pending_admin_estimate" && <button onClick={() => jobAction(job,"estimate_laser")} className="admin-action text-amber-200"><ClockIcon />填入時長</button>}{job.status === "pending_admin_review" && <button onClick={() => jobAction(job,"approve")} className="admin-action text-emerald-200"><Check />核准</button>}{job.status === "queued" && <button onClick={() => jobAction(job,"start")} className="admin-action text-emerald-200"><Play />開始</button>}{job.status === "running" && <><button onClick={() => jobAction(job,"complete")} className="admin-action text-emerald-200"><Square />完成</button><button onClick={() => jobAction(job,"fail")} className="admin-action text-rose-200"><XCircle />失敗</button></>}{job.status === "completed" && !job.collectedAt && <button onClick={() => jobAction(job,"collect")} className="admin-action text-cyan-200"><PackageCheck />確認已取件</button>}{["pending_admin_review","pending_admin_estimate","queued"].includes(job.status) && <button onClick={() => jobAction(job,"reject")} className="admin-action text-rose-200"><XCircle />拒絕</button>}</div>
    </article>)}</div></section>
  </div>;
}

function ClockIcon() { return <span className="font-mono">MIN</span>; }
