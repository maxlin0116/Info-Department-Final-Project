import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { Box, CheckCircle2, Clock3, FileUp, Loader2, RotateCcw, Scissors, Send, Settings2 } from "lucide-react";
import { useAuth } from "../auth";
import { apiUrl, authHeaders, readApi } from "../api";
import type { AmsSlot, FabricationConfig, FabricationJob, ServiceType } from "../fabricationTypes";
import { formatMinutes } from "../fabricationTypes";
import { ThreeModelPreview } from "./ThreeModelPreview";
import { ThreeDpSettingsPanel } from "./ThreeDpSettingsPanel";
import { DEFAULT_THREE_DP_SETTINGS, readThreeMfSettings, type ThreeDpSettings, type ThreeMfImportInfo } from "../threeDpSettings";

const fieldClass = "w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500";
const labelClass = "block text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-1.5";
const laserMaterialOptions = ["3mm 密集板", "5mm 密集板", "3mm 壓克力", "5mm 壓克力"];

function SliceResult({ job, slots, token, onConfirmed }: { job: FabricationJob; slots: AmsSlot[]; token: string; onConfirmed: (job: FabricationJob) => void }) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    if (!selectedSlot) return setError("請選擇 AMS 顏色");
    setSubmitting(true);
    setError("");
    try {
      const payload = await readApi<{ job: FabricationJob }>(await fetch(apiUrl(`/api/fabrication/jobs/${job.id}/confirm`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ amsSlot: selectedSlot })
      }));
      onConfirmed(payload.job);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "確認失敗");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        <div><h2 className="font-mono text-lg text-slate-100">切片完成</h2><p className="text-sm text-slate-400">{job.slicerProfileVersion}</p></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="總預估時間" value={formatMinutes(job.estimatedMinutes)} />
        <Metric label="Quota 扣除" value={`${job.estimatedMinutes ?? 0} min`} />
        <Metric label="總消耗克數" value={job.filamentGrams != null ? `${job.filamentGrams.toFixed(1)} g` : "—"} />
        <Metric label="材料費" value={job.materialFee != null ? `NT$ ${job.materialFee}` : "—"} />
        <Metric label="Layer" value={job.layerCount ? String(job.layerCount) : "—"} />
      </div>
      <p className="text-xs text-slate-400">材料費按總耗材克數 ÷ 2 後四捨五入計算。</p>
      <div>
        <div className={labelClass}>選擇目前 AMS 顏色（單色列印）</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {slots.map((slot) => (
            <button key={slot.slot} disabled={!slot.available} onClick={() => setSelectedSlot(slot.slot)}
              className={`rounded-xl border p-3 text-left transition-all ${selectedSlot === slot.slot ? "border-emerald-400 bg-emerald-500/10" : "border-slate-700 bg-slate-950/60"} disabled:opacity-40`}>
              <span className="block w-8 h-8 rounded-full border border-white/20 mb-2" style={{ backgroundColor: slot.colorHex }} />
              <span className="block text-sm font-semibold text-slate-100">Slot {slot.slot} · {slot.colorName}</span>
              <span className="text-xs text-slate-500">{slot.material}</span>
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <button onClick={confirm} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 font-semibold text-slate-950 disabled:opacity-50">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 確認並送交管理員
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{label}</div><div className="mt-1 text-lg font-mono text-slate-100">{value}</div></div>;
}

export function FabricationSubmit() {
  const { serviceType: rawServiceType } = useParams();
  const serviceType: ServiceType = rawServiceType === "laser" ? "laser" : "3dp";
  const { token, isAuthenticated } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [material, setMaterial] = useState(laserMaterialOptions[0]);
  const [printSettings, setPrintSettings] = useState<ThreeDpSettings>({ ...DEFAULT_THREE_DP_SETTINGS });
  const [importInfo, setImportInfo] = useState<ThreeMfImportInfo | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "reading" | "imported" | "not-found" | "error">("idle");
  const [importMessage, setImportMessage] = useState("");
  const [config, setConfig] = useState<FabricationConfig | null>(null);
  const [job, setJob] = useState<FabricationJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => readApi<{ config: FabricationConfig }>(await fetch(apiUrl("/api/fabrication/config")));
    load().then((result) => setConfig(result.config)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!job || !token || job.status !== "slicing") return;
    const poll = async () => {
      try {
        const result = await readApi<{ job: FabricationJob }>(await fetch(apiUrl(`/api/fabrication/jobs/${job.id}`), { headers: authHeaders(token) }));
        setJob(result.job);
      } catch { /* keep polling transient failures */ }
    };
    const interval = window.setInterval(poll, 2500);
    void poll();
    return () => window.clearInterval(interval);
  }, [job?.id, job?.status, token]);

  const accepts = serviceType === "3dp" ? ".stl,.3mf" : ".dxf";
  const machine = useMemo(() => config?.machines.find((item) => item.serviceType === serviceType), [config, serviceType]);

  const chooseFile = async (selectedFile: File | null) => {
    setFile(selectedFile);
    setJob(null);
    setError("");
    setImportInfo(null);
    setPrintSettings({ ...DEFAULT_THREE_DP_SETTINGS });
    if (!selectedFile || serviceType !== "3dp") {
      setImportStatus("idle");
      setImportMessage("");
      return;
    }
    if (!title.trim()) setTitle(selectedFile.name.replace(/\.(stl|3mf)$/i, "").slice(0, 80));
    if (!selectedFile.name.toLowerCase().endsWith(".3mf")) {
      setImportStatus("not-found");
      setImportMessage("STL 不含切片設定，已使用 P1S／Bambu PLA 預設值");
      return;
    }
    setImportStatus("reading");
    setImportMessage("");
    try {
      const imported = await readThreeMfSettings(selectedFile);
      setPrintSettings(imported.settings);
      setImportInfo(imported.info);
      setImportStatus("imported");
      setImportMessage(`已從 3MF 匯入 ${imported.info.importedSettingCount} 項切片設定`);
    } catch (importError) {
      setImportStatus("error");
      setImportMessage(importError instanceof Error ? importError.message : "無法讀取 3MF 設定，已使用安全預設值");
    }
  };

  if (!isAuthenticated || !token) return <Navigate to="/login" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return setError("請先選擇檔案");
    setSubmitting(true);
    setError("");
    const data = new FormData();
    data.append("file", file);
    if (serviceType === "3dp") data.append("title", title);
    data.append("comment", comment);
    data.append("material", serviceType === "3dp" ? "Bambu PLA Basic" : material);
    if (serviceType === "3dp") data.append("sliceSettings", JSON.stringify(printSettings));
    try {
      const payload = await readApi<{ job: FabricationJob }>(await fetch(apiUrl(`/api/fabrication/jobs/${serviceType}`), {
        method: "POST", headers: authHeaders(token), body: data
      }));
      setJob(payload.job);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "送出失敗");
    } finally { setSubmitting(false); }
  };

  const retrySlice = async () => {
    if (!job || !token) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = await readApi<{ job: FabricationJob }>(await fetch(apiUrl(`/api/fabrication/jobs/${job.id}/retry-slice`), {
        method: "POST",
        headers: authHeaders(token)
      }));
      setJob(payload.job);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "重試切片失敗");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-mono text-emerald-400 uppercase">{serviceType === "3dp" ? "P1S Print Workspace" : "Laser Intake"}</p><h1 className="text-2xl font-mono font-semibold text-slate-100 mt-1">{serviceType === "3dp" ? "3DP 切片與送件" : "雷切檔案送件"}</h1></div>
        <div className="text-right text-xs font-mono text-slate-400"><div>{machine?.name || "Machine"}</div><div className={machine?.serviceOpen ? "text-emerald-400" : "text-rose-400"}>{machine?.serviceOpen ? machine?.status?.toUpperCase() : "SERVICE_CLOSED"}</div></div>
      </div>

      {job?.status === "slice_ready" && config ? <SliceResult job={job} slots={config.amsSlots.filter((slot) => slot.available)} token={token} onConfirmed={setJob} /> :
       job?.status === "slicing" ? <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-10 text-center"><Loader2 className="w-9 h-9 animate-spin text-sky-400 mx-auto" /><h2 className="mt-4 font-mono text-slate-100">Bambu Studio 正在切片</h2><p className="text-sm text-slate-400 mt-1">P1S · 0.4 mm · Bambu PLA Basic</p></div> :
       job?.status === "slice_failed" ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5"><h2 className="font-semibold text-rose-200">切片失敗</h2><p className="mt-2 text-sm text-rose-100/80 whitespace-pre-wrap">{job.slicerError}</p><p className="mt-3 text-xs text-slate-400">請檢查 Linux slicing worker、P1S profiles 與切片參數。</p>{error && <p className="mt-3 text-sm text-rose-200">{error}</p>}<button type="button" onClick={retrySlice} disabled={submitting} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-sky-500/40 px-4 py-2 text-sm text-sky-200 disabled:opacity-50">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}使用相同檔案重試</button></div> :
       job && ["pending_admin_review", "queued"].includes(job.status) ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6"><CheckCircle2 className="w-7 h-7 text-emerald-400" /><h2 className="mt-3 text-lg font-mono text-slate-100">已送交管理員</h2><p className="text-sm text-slate-400 mt-1">狀態：{job.status} · {formatMinutes(job.estimatedMinutes)}</p><Link to="/fabrication/jobs" className="inline-block mt-4 text-emerald-300 underline">查看我的加工工作</Link></div> :
       job?.status === "pending_admin_estimate" ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6"><Clock3 className="w-7 h-7 text-amber-300" /><h2 className="mt-3 text-lg font-mono text-slate-100">檔案已上傳，等待管理員估時</h2><p className="text-sm text-slate-400 mt-1">管理員確認 DXF 並填入時長後，工作會進入雷切 queue。</p><Link to="/fabrication/jobs" className="inline-block mt-4 text-amber-200 underline">查看我的加工工作</Link></div> :
      <form onSubmit={submit} className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)] gap-6">
        <div className="space-y-4">
          {serviceType === "3dp" ? <ThreeModelPreview file={file} scalePercent={printSettings.scalePercent} autoOrient={printSettings.autoOrient} layerHeight={printSettings.layerHeight} infillPercent={printSettings.infillPercent} infillPattern={printSettings.infillPattern} supportType={printSettings.supportType} brimEnabled={printSettings.brimType !== "no_brim"} /> : <div className="h-[300px] rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 flex flex-col items-center justify-center"><Scissors className="w-12 h-12 text-slate-600" /><p className="mt-4 text-slate-300 font-mono">DXF FILE INTAKE</p><p className="text-sm text-slate-500 mt-1">加工時間由管理員檢查後填入</p></div>}
          <label className="flex items-center justify-center gap-3 rounded-xl border border-dashed border-slate-600 bg-slate-900/50 px-5 py-5 cursor-pointer hover:border-emerald-500/60">
            <FileUp className="w-5 h-5 text-emerald-400" /><span className="text-sm text-slate-300">{file ? file.name : `選擇 ${accepts} 檔案`}</span>
            <input type="file" accept={accepts} className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-5">
          <div className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-emerald-400" /><h2 className="font-mono text-slate-100">JOB_SETTINGS</h2></div>
          {serviceType === "3dp" && <div><label className={labelClass}>工作名稱</label><input required maxLength={80} className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} /></div>}
          {serviceType === "3dp" ? <ThreeDpSettingsPanel settings={printSettings} importInfo={importInfo} importStatus={importStatus} importMessage={importMessage} onChange={setPrintSettings} onReset={() => { setPrintSettings({ ...DEFAULT_THREE_DP_SETTINGS }); setImportInfo(null); setImportStatus("idle"); setImportMessage(""); }} /> : <>
            <div><label className={labelClass}>材料與厚度</label><select required className={fieldClass} value={material} onChange={(event) => setMaterial(event.target.value)}>{laserMaterialOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
          </>}
          <div><label className={labelClass}>備註</label><textarea rows={3} maxLength={1000} className={fieldClass} value={comment} onChange={(event) => setComment(event.target.value)} /></div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button disabled={submitting || !machine?.serviceOpen} className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : serviceType === "3dp" ? <Box className="w-4 h-4" /> : <FileUp className="w-4 h-4" />}
            {serviceType === "3dp" ? "上傳並開始切片" : "上傳給管理員估時"}
          </button>
        </div>
      </form>}
    </div>
  );
}
