import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { ThreeDpSettings, ThreeMfImportInfo } from "../threeDpSettings";

const fieldClass = "w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500";
const labelClass = "block text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-1.5";
const tabs = ["品質", "強度", "速度", "支撐", "其他"] as const;
type Tab = (typeof tabs)[number];

interface Props {
  settings: ThreeDpSettings;
  importInfo: ThreeMfImportInfo | null;
  importStatus: "idle" | "reading" | "imported" | "not-found" | "error";
  importMessage: string;
  onChange: (next: ThreeDpSettings) => void;
  onReset: () => void;
}

function NumberField({ label, value, min, max, step = 1, unit, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <input type="number" min={min} max={max} step={step} className={`${fieldClass} ${unit ? "pr-12" : ""}`} value={value}
          onChange={(event) => onChange(Number(event.target.value))} />
        {unit && <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-300">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-emerald-500" />
    </label>
  );
}

export function ThreeDpSettingsPanel({ settings, importInfo, importStatus, importMessage, onChange, onReset }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("品質");
  const [advanced, setAdvanced] = useState(true);
  const update = <K extends keyof ThreeDpSettings>(key: K, value: ThreeDpSettings[K]) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-emerald-400" /><h2 className="font-mono text-slate-100">BAMBU_PRINT_SETTINGS</h2></div>
        <label className="flex items-center gap-2 text-xs text-slate-400"><span>高階</span><input type="checkbox" checked={advanced} onChange={(event) => setAdvanced(event.target.checked)} className="h-4 w-4 accent-emerald-500" /></label>
      </div>

      {importStatus !== "idle" && (
        <div className={`rounded-xl border px-3 py-3 text-xs ${importStatus === "imported" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : importStatus === "reading" ? "border-sky-500/30 bg-sky-500/10 text-sky-100" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>
          <div className="font-semibold">{importStatus === "reading" ? "正在讀取 3MF 設定…" : importMessage}</div>
          {importInfo && (
            <div className="mt-1.5 space-y-0.5 text-slate-300">
              <div>{importInfo.processProfile || "未命名製程"} · {importInfo.printerModel || "未知機型"}</div>
              {importInfo.embeddedScalePercent && <div>模型內含 {importInfo.embeddedScalePercent}% 變形，預覽與切片會保留；下方 Scale 是額外縮放。</div>}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
        <div className="flex items-center justify-between"><span className="text-xs font-mono text-slate-400">物件變形</span><button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"><RotateCcw className="h-3.5 w-3.5" />重設全部</button></div>
        <div><label className={labelClass}>Scale · {settings.scalePercent}%</label><input aria-label="Scale" type="range" min="25" max="200" step="1" className="w-full accent-emerald-500" value={settings.scalePercent} onChange={(event) => update("scalePercent", Number(event.target.value))} /></div>
        <Toggle label="Auto orient（額外重新定向）" checked={settings.autoOrient} onChange={(value) => update("autoOrient", value)} />
      </div>

      <div className="flex overflow-x-auto border-b border-slate-700">
        {tabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${activeTab === tab ? "border-emerald-400 text-emerald-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}>{tab}</button>)}
      </div>

      {activeTab === "品質" && <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="層高" value={settings.layerHeight} min={0.08} max={0.28} step={0.01} unit="mm" onChange={(value) => update("layerHeight", value)} />
          <NumberField label="首層高度" value={settings.initialLayerHeight} min={0.08} max={0.4} step={0.01} unit="mm" onChange={(value) => update("initialLayerHeight", value)} />
        </div>
        <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>牆生成器</label><select className={fieldClass} value={settings.wallGenerator} onChange={(event) => update("wallGenerator", event.target.value as ThreeDpSettings["wallGenerator"])}><option value="classic">Classic</option><option value="arachne">Arachne</option></select></div><div><label className={labelClass}>接縫位置</label><select className={fieldClass} value={settings.seamPosition} onChange={(event) => update("seamPosition", event.target.value as ThreeDpSettings["seamPosition"])}><option value="aligned">Aligned</option><option value="nearest">Nearest</option><option value="back">Back</option><option value="random">Random</option></select></div></div>
        {advanced && <div className="space-y-3 rounded-xl border border-slate-800 p-3"><div className="text-sm font-semibold text-slate-200">精度</div><div className="grid grid-cols-2 gap-3">
          <NumberField label="切片間隙閉合半徑" value={settings.sliceClosingRadius} min={0} max={1} step={0.001} unit="mm" onChange={(value) => update("sliceClosingRadius", value)} />
          <NumberField label="解析度" value={settings.resolution} min={0.001} max={1} step={0.001} unit="mm" onChange={(value) => update("resolution", value)} />
          <NumberField label="X-Y 內輪廓尺寸補償" value={settings.xyHoleCompensation} min={-2} max={2} step={0.01} unit="mm" onChange={(value) => update("xyHoleCompensation", value)} />
          <NumberField label="X-Y 外輪廓尺寸補償" value={settings.xyContourCompensation} min={-2} max={2} step={0.01} unit="mm" onChange={(value) => update("xyContourCompensation", value)} />
          <NumberField label="象腳補償" value={settings.elephantFootCompensation} min={0} max={1} step={0.01} unit="mm" onChange={(value) => update("elephantFootCompensation", value)} />
        </div><Toggle label="圓弧擬合" checked={settings.arcFitting} onChange={(value) => update("arcFitting", value)} /><Toggle label="精準 Z 高度" checked={settings.preciseZHeight} onChange={(value) => update("preciseZHeight", value)} /></div>}
      </div>}

      {activeTab === "強度" && <div className="space-y-4"><div className="grid grid-cols-3 gap-3">
        <NumberField label="牆層數" value={settings.wallLoops} min={1} max={10} onChange={(value) => update("wallLoops", value)} />
        <NumberField label="頂層層數" value={settings.topShellLayers} min={0} max={20} onChange={(value) => update("topShellLayers", value)} />
        <NumberField label="底層層數" value={settings.bottomShellLayers} min={0} max={20} onChange={(value) => update("bottomShellLayers", value)} />
      </div><div className="grid grid-cols-2 gap-3"><NumberField label="填充密度" value={settings.infillPercent} min={0} max={100} unit="%" onChange={(value) => update("infillPercent", value)} /><div><label className={labelClass}>填充圖樣</label><select className={fieldClass} value={settings.infillPattern} onChange={(event) => update("infillPattern", event.target.value)}><option value="grid">Grid</option><option value="gyroid">Gyroid</option><option value="honeycomb">Honeycomb</option><option value="rectilinear">Rectilinear</option><option value="cubic">Cubic</option><option value="adaptivecubic">Adaptive cubic</option><option value="lightning">Lightning</option></select></div></div></div>}

      {activeTab === "速度" && <div className="grid grid-cols-2 gap-3">
        <NumberField label="外牆速度" value={settings.outerWallSpeed} min={10} max={500} unit="mm/s" onChange={(value) => update("outerWallSpeed", value)} />
        <NumberField label="內牆速度" value={settings.innerWallSpeed} min={10} max={500} unit="mm/s" onChange={(value) => update("innerWallSpeed", value)} />
        <NumberField label="稀疏填充速度" value={settings.infillSpeed} min={10} max={500} unit="mm/s" onChange={(value) => update("infillSpeed", value)} />
        <NumberField label="頂面速度" value={settings.topSurfaceSpeed} min={10} max={500} unit="mm/s" onChange={(value) => update("topSurfaceSpeed", value)} />
        <NumberField label="空駛速度" value={settings.travelSpeed} min={10} max={700} unit="mm/s" onChange={(value) => update("travelSpeed", value)} />
      </div>}

      {activeTab === "支撐" && <div className="space-y-4"><div><label className={labelClass}>支撐類型</label><select className={fieldClass} value={settings.supportType} onChange={(event) => update("supportType", event.target.value as ThreeDpSettings["supportType"])}><option value="none">不啟用</option><option value="normal-auto">普通（自動）</option><option value="tree-auto">樹狀（自動）</option><option value="normal-manual">普通（僅手動畫區）</option><option value="tree-manual">樹狀（僅手動畫區）</option></select></div><div className="grid grid-cols-2 gap-3">
        <NumberField label="支撐臨界角度" value={settings.supportThresholdAngle} min={0} max={90} unit="°" onChange={(value) => update("supportThresholdAngle", value)} />
        <NumberField label="支撐／物件 XY 距離" value={settings.supportXyDistance} min={0} max={2} step={0.05} unit="mm" onChange={(value) => update("supportXyDistance", value)} />
        <NumberField label="頂部 Z 距離" value={settings.supportTopZDistance} min={0} max={1} step={0.01} unit="mm" onChange={(value) => update("supportTopZDistance", value)} />
      </div><Toggle label="僅在熱床產生支撐" checked={settings.supportOnBuildPlateOnly} onChange={(value) => update("supportOnBuildPlateOnly", value)} /></div>}

      {activeTab === "其他" && <div className="space-y-4"><div><label className={labelClass}>裙邊／Brim 類型</label><select className={fieldClass} value={settings.brimType} onChange={(event) => update("brimType", event.target.value as ThreeDpSettings["brimType"])}><option value="no_brim">不使用</option><option value="auto_brim">自動</option><option value="outer_only">僅外側</option><option value="inner_only">僅內側</option><option value="outer_and_inner">內外側</option></select></div><div className="grid grid-cols-2 gap-3"><NumberField label="Brim 寬度" value={settings.brimWidth} min={0} max={30} step={0.5} unit="mm" onChange={(value) => update("brimWidth", value)} /><NumberField label="Brim 與物件間隙" value={settings.brimObjectGap} min={0} max={2} step={0.05} unit="mm" onChange={(value) => update("brimObjectGap", value)} /></div><div><label className={labelClass}>熨燙類型</label><select className={fieldClass} value={settings.ironingType} onChange={(event) => update("ironingType", event.target.value as ThreeDpSettings["ironingType"])}><option value="no ironing">不熨燙</option><option value="top">所有頂面</option><option value="topmost">最上層表面</option><option value="all solid">所有實心層</option></select></div>{advanced && <div className="grid grid-cols-2 gap-3"><NumberField label="熨燙流量" value={settings.ironingFlow} min={1} max={100} unit="%" onChange={(value) => update("ironingFlow", value)} /><NumberField label="熨燙速度" value={settings.ironingSpeed} min={1} max={150} unit="mm/s" onChange={(value) => update("ironingSpeed", value)} /></div>}</div>}

      <p className="text-xs leading-5 text-slate-500">3MF 內原有的模型位置、旋轉與縮放會保留；此處只覆寫你實際修改或匯入的安全切片參數。機型與耗材固定使用伺服器的 P1S／Bambu PLA 設定。</p>
    </div>
  );
}
