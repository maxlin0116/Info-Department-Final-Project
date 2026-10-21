import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../i18n";
import type { ThreeDpSettings, ThreeMfImportInfo } from "../threeDpSettings";

const fieldClass = "w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500";
const labelClass = "block text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-1.5";
const tabs = [
  { key: "quality", zh: "品質", en: "Quality" },
  { key: "strength", zh: "強度", en: "Strength" },
  { key: "speed", zh: "速度", en: "Speed" },
  { key: "support", zh: "支撐", en: "Support" },
  { key: "other", zh: "其他", en: "Other" },
] as const;
type TabKey = (typeof tabs)[number]["key"];

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
  const { lang, tx } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabKey>("quality");
  const [advanced, setAdvanced] = useState(true);
  const update = <K extends keyof ThreeDpSettings>(key: K, value: ThreeDpSettings[K]) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-emerald-400" /><h2 className="font-mono text-slate-100">BAMBU_PRINT_SETTINGS</h2></div>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer"><span>{tx("高階", "Advanced")}</span><input type="checkbox" checked={advanced} onChange={(event) => setAdvanced(event.target.checked)} className="h-4 w-4 accent-emerald-500" /></label>
      </div>

      {importStatus !== "idle" && (
        <div className={`rounded-xl border px-3 py-3 text-xs ${importStatus === "imported" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : importStatus === "reading" ? "border-sky-500/30 bg-sky-500/10 text-sky-100" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>
          <div className="font-semibold">{importStatus === "reading" ? tx("正在讀取 3MF 設定…", "Reading 3MF settings...") : importMessage}</div>
          {importInfo && (
            <div className="mt-1.5 space-y-0.5 text-slate-300">
              <div>{importInfo.processProfile || tx("未命名製程", "Unnamed process profile")} · {importInfo.printerModel || tx("未知機型", "Unknown printer model")}</div>
              {importInfo.embeddedScalePercent && <div>{tx(`模型內含 ${importInfo.embeddedScalePercent}% 變形，預覽與切片會保留；下方 Scale 是額外縮放。`, `Embedded model transform (${importInfo.embeddedScalePercent}%) will be preserved in preview and slicing; Scale below is additional scaling.`)}</div>}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
        <div className="flex items-center justify-between"><span className="text-xs font-mono text-slate-400">{tx("物件變形", "Object Transform")}</span><button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"><RotateCcw className="h-3.5 w-3.5" />{tx("重設全部", "Reset All")}</button></div>
        <div><label className={labelClass}>Scale · {settings.scalePercent}%</label><input aria-label="Scale" type="range" min="25" max="200" step="1" className="w-full accent-emerald-500" value={settings.scalePercent} onChange={(event) => update("scalePercent", Number(event.target.value))} /></div>
        <Toggle label={tx("Auto orient（自動重新定向）", "Auto orient (automatic reorientation)")} checked={settings.autoOrient} onChange={(value) => update("autoOrient", value)} />
      </div>

      <div className="flex overflow-x-auto border-b border-slate-700">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm cursor-pointer ${activeTab === tab.key ? "border-emerald-400 text-emerald-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
            {lang === "zh" ? tab.zh : tab.en}
          </button>
        ))}
      </div>

      {activeTab === "quality" && <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label={tx("層高", "Layer Height")} value={settings.layerHeight} min={0.08} max={0.28} step={0.01} unit="mm" onChange={(value) => update("layerHeight", value)} />
          <NumberField label={tx("首層高度", "Initial Layer Height")} value={settings.initialLayerHeight} min={0.08} max={0.4} step={0.01} unit="mm" onChange={(value) => update("initialLayerHeight", value)} />
        </div>
        <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>{tx("牆生成器", "Wall Generator")}</label><select className={fieldClass} value={settings.wallGenerator} onChange={(event) => update("wallGenerator", event.target.value as ThreeDpSettings["wallGenerator"])}><option value="classic">Classic</option><option value="arachne">Arachne</option></select></div><div><label className={labelClass}>{tx("接縫位置", "Seam Position")}</label><select className={fieldClass} value={settings.seamPosition} onChange={(event) => update("seamPosition", event.target.value as ThreeDpSettings["seamPosition"])}><option value="aligned">Aligned</option><option value="nearest">Nearest</option><option value="back">Back</option><option value="random">Random</option></select></div></div>
        {advanced && <div className="space-y-3 rounded-xl border border-slate-800 p-3"><div className="text-sm font-semibold text-slate-200">{tx("精度", "Precision")}</div><div className="grid grid-cols-2 gap-3">
          <NumberField label={tx("切片間隙閉合半徑", "Slice Gap Closing Radius")} value={settings.sliceClosingRadius} min={0} max={1} step={0.001} unit="mm" onChange={(value) => update("sliceClosingRadius", value)} />
          <NumberField label={tx("解析度", "Resolution")} value={settings.resolution} min={0.001} max={1} step={0.001} unit="mm" onChange={(value) => update("resolution", value)} />
          <NumberField label={tx("X-Y 內輪廓尺寸補償", "X-Y Hole Compensation")} value={settings.xyHoleCompensation} min={-2} max={2} step={0.01} unit="mm" onChange={(value) => update("xyHoleCompensation", value)} />
          <NumberField label={tx("X-Y 外輪廓尺寸補償", "X-Y Contour Compensation")} value={settings.xyContourCompensation} min={-2} max={2} step={0.01} unit="mm" onChange={(value) => update("xyContourCompensation", value)} />
          <NumberField label={tx("象腳補償", "Elephant Foot Compensation")} value={settings.elephantFootCompensation} min={0} max={1} step={0.01} unit="mm" onChange={(value) => update("elephantFootCompensation", value)} />
        </div><Toggle label={tx("圓弧擬合", "Arc Fitting")} checked={settings.arcFitting} onChange={(value) => update("arcFitting", value)} /><Toggle label={tx("精準 Z 高度", "Precise Z Height")} checked={settings.preciseZHeight} onChange={(value) => update("preciseZHeight", value)} /></div>}
      </div>}

      {activeTab === "strength" && <div className="space-y-4"><div className="grid grid-cols-3 gap-3">
        <NumberField label={tx("牆層數", "Wall Loops")} value={settings.wallLoops} min={1} max={10} onChange={(value) => update("wallLoops", value)} />
        <NumberField label={tx("頂層層數", "Top Shell Layers")} value={settings.topShellLayers} min={0} max={20} onChange={(value) => update("topShellLayers", value)} />
        <NumberField label={tx("底層層數", "Bottom Shell Layers")} value={settings.bottomShellLayers} min={0} max={20} onChange={(value) => update("bottomShellLayers", value)} />
      </div><div className="grid grid-cols-2 gap-3"><NumberField label={tx("填充密度", "Infill Density")} value={settings.infillPercent} min={0} max={100} unit="%" onChange={(value) => update("infillPercent", value)} /><div><label className={labelClass}>{tx("填充圖樣", "Infill Pattern")}</label><select className={fieldClass} value={settings.infillPattern} onChange={(event) => update("infillPattern", event.target.value)}><option value="grid">Grid</option><option value="gyroid">Gyroid</option><option value="honeycomb">Honeycomb</option><option value="rectilinear">Rectilinear</option><option value="cubic">Cubic</option><option value="adaptivecubic">Adaptive cubic</option><option value="lightning">Lightning</option></select></div></div></div>}

      {activeTab === "speed" && <div className="grid grid-cols-2 gap-3">
        <NumberField label={tx("外牆速度", "Outer Wall Speed")} value={settings.outerWallSpeed} min={10} max={500} unit="mm/s" onChange={(value) => update("outerWallSpeed", value)} />
        <NumberField label={tx("內牆速度", "Inner Wall Speed")} value={settings.innerWallSpeed} min={10} max={500} unit="mm/s" onChange={(value) => update("innerWallSpeed", value)} />
        <NumberField label={tx("稀疏填充速度", "Sparse Infill Speed")} value={settings.infillSpeed} min={10} max={500} unit="mm/s" onChange={(value) => update("infillSpeed", value)} />
        <NumberField label={tx("頂面速度", "Top Surface Speed")} value={settings.topSurfaceSpeed} min={10} max={500} unit="mm/s" onChange={(value) => update("topSurfaceSpeed", value)} />
        <NumberField label={tx("空駛速度", "Travel Speed")} value={settings.travelSpeed} min={10} max={700} unit="mm/s" onChange={(value) => update("travelSpeed", value)} />
      </div>}

      {activeTab === "support" && <div className="space-y-4"><div><label className={labelClass}>{tx("支撐類型", "Support Type")}</label><select className={fieldClass} value={settings.supportType} onChange={(event) => update("supportType", event.target.value as ThreeDpSettings["supportType"])}><option value="none">{tx("不啟用", "None / Disabled")}</option><option value="normal-auto">{tx("普通（自動）", "Normal (auto)")}</option><option value="tree-auto">{tx("樹狀（自動）", "Tree (auto)")}</option><option value="normal-manual">{tx("普通（僅手動畫區）", "Normal (manual painted)")}</option><option value="tree-manual">{tx("樹狀（僅手動畫區）", "Tree (manual painted)")}</option></select></div><div className="grid grid-cols-2 gap-3">
        <NumberField label={tx("支撐臨界角度", "Support Threshold Angle")} value={settings.supportThresholdAngle} min={0} max={90} unit="°" onChange={(value) => update("supportThresholdAngle", value)} />
        <NumberField label={tx("支撐／物件 XY 距離", "Support/Object XY Distance")} value={settings.supportXyDistance} min={0} max={2} step={0.05} unit="mm" onChange={(value) => update("supportXyDistance", value)} />
        <NumberField label={tx("頂部 Z 距離", "Top Z Distance")} value={settings.supportTopZDistance} min={0} max={1} step={0.01} unit="mm" onChange={(value) => update("supportTopZDistance", value)} />
      </div><Toggle label={tx("僅在熱床產生支撐", "Support on Build Plate Only")} checked={settings.supportOnBuildPlateOnly} onChange={(value) => update("supportOnBuildPlateOnly", value)} /></div>}

      {activeTab === "other" && <div className="space-y-4"><div><label className={labelClass}>{tx("裙邊／Brim 類型", "Brim Type")}</label><select className={fieldClass} value={settings.brimType} onChange={(event) => update("brimType", event.target.value as ThreeDpSettings["brimType"])}><option value="no_brim">{tx("不使用", "No Brim")}</option><option value="auto_brim">{tx("自動", "Auto Brim")}</option><option value="outer_only">{tx("僅外側", "Outer Only")}</option><option value="inner_only">{tx("僅內側", "Inner Only")}</option><option value="outer_and_inner">{tx("內外側", "Outer & Inner")}</option></select></div><div className="grid grid-cols-2 gap-3"><NumberField label={tx("Brim 寬度", "Brim Width")} value={settings.brimWidth} min={0} max={30} step={0.5} unit="mm" onChange={(value) => update("brimWidth", value)} /><NumberField label={tx("Brim 與物件間隙", "Brim-Object Gap")} value={settings.brimObjectGap} min={0} max={2} step={0.05} unit="mm" onChange={(value) => update("brimObjectGap", value)} /></div><div><label className={labelClass}>{tx("熨燙類型", "Ironing Type")}</label><select className={fieldClass} value={settings.ironingType} onChange={(event) => update("ironingType", event.target.value as ThreeDpSettings["ironingType"])}><option value="no ironing">{tx("不熨燙", "No Ironing")}</option><option value="top">{tx("所有頂面", "All Top Surfaces")}</option><option value="topmost">{tx("最上層表面", "Topmost Surface Only")}</option><option value="all solid">{tx("所有實心層", "All Solid Layers")}</option></select></div>{advanced && <div className="grid grid-cols-2 gap-3"><NumberField label={tx("熨燙流量", "Ironing Flow")} value={settings.ironingFlow} min={1} max={100} unit="%" onChange={(value) => update("ironingFlow", value)} /><NumberField label={tx("熨燙速度", "Ironing Speed")} value={settings.ironingSpeed} min={1} max={150} unit="mm/s" onChange={(value) => update("ironingSpeed", value)} /></div>}</div>}

      <p className="text-xs leading-5 text-slate-500">{tx("3MF 內原有的模型位置、旋轉與縮放會保留；此處只覆寫你實際修改或匯入的安全切片參數。機型與耗材固定使用伺服器的 P1S／Bambu PLA 設定。", "Original model position, rotation, and scaling in 3MF are preserved; only customized or imported safe slicing parameters are applied. Machine and filament profiles are fixed to server P1S / Bambu PLA settings.")}</p>
    </div>
  );
}
