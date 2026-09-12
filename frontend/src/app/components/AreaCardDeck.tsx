import { Link } from "react-router";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Hammer,
  Layers,
  Plus,
  Printer,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AreaSummary {
  id: string;
  name: string;
  type: string;
  maxCapacity: number;
  description: string;
  showPrintingStatus: boolean;
  isActive: boolean;
  bookingMode: "schedule" | "queue";
  serviceType: "meeting" | "soldering" | "3dp" | "laser";
}

interface AreaStatusItem {
  area: AreaSummary;
  usedCount: number;
  remainingCapacity: number;
  activeReservationCount: number;
  isFull: boolean;
  hasActivePrinting: boolean;
  queueLength?: number;
  machineStatus?: string;
  serviceOpen?: boolean;
}

interface AreaCardDeckProps {
  areas: AreaStatusItem[];
  selectedAreaId: string | "all";
  onSelectArea: (areaId: string | "all") => void;
  onBookArea: (area: AreaSummary) => void;
}

const getAreaMeta = (type: string) => {
  switch (type) {
    case "meeting":
      return { icon: Users, eyebrow: "MakerSpace General Access", color: "emerald" };
    case "soldering":
      return { icon: Hammer, eyebrow: "Electronics & Soldering", color: "emerald" };
    case "3dp":
      return { icon: Printer, eyebrow: "3D Printing Queue", color: "cyan" };
    case "heavy_processing":
      return { icon: Zap, eyebrow: "Machining & Laser Cutter", color: "amber" };
    default:
      return { icon: Layers, eyebrow: "MakerSpace Area", color: "emerald" };
  }
};

const getStatusDetails = (item: AreaStatusItem) => {
  if (!item.area.isActive || item.serviceOpen === false) {
    return { label: "MAINTENANCE", color: "text-amber-400 bg-amber-400/10 border-amber-400/30" };
  }
  if (item.area.bookingMode === "queue") {
    const status = item.machineStatus || "idle";
    return status === "running"
      ? { label: "PRINTING", color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30" }
      : { label: "IDLE", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" };
  }
  if (item.isFull) {
    return { label: "FULL", color: "text-rose-400 bg-rose-400/10 border-rose-400/30" };
  }
  if (item.usedCount > 0) {
    return { label: "OCCUPIED", color: "text-amber-400 bg-amber-400/10 border-amber-400/30" };
  }
  return { label: "AVAILABLE", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" };
};

export function AreaCardDeck({
  areas,
  selectedAreaId,
  onSelectArea,
  onBookArea,
}: AreaCardDeckProps) {
  const isAllSelected = selectedAreaId === "all";

  // Cycle navigation helpers
  const currentIndex = areas.findIndex((a) => a.area.id === selectedAreaId);

  const handleNext = () => {
    if (isAllSelected) {
      if (areas.length > 0) onSelectArea(areas[0].area.id);
    } else if (currentIndex < areas.length - 1) {
      onSelectArea(areas[currentIndex + 1].area.id);
    } else {
      onSelectArea("all");
    }
  };

  const handlePrev = () => {
    if (isAllSelected) {
      if (areas.length > 0) onSelectArea(areas[areas.length - 1].area.id);
    } else if (currentIndex > 0) {
      onSelectArea(areas[currentIndex - 1].area.id);
    } else {
      onSelectArea("all");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* "ALL AREAS" Overview Selector Card */}
      <motion.button
        type="button"
        onClick={() => onSelectArea("all")}
        whileTap={{ scale: 0.98 }}
        className={`w-full p-4 rounded-xl border text-left transition-all duration-300 cursor-pointer flex items-center justify-between ${
          isAllSelected
            ? "bg-slate-900 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.2)] ring-1 ring-cyan-500/40"
            : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700 opacity-60 hover:opacity-90"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg border ${
              isAllSelected
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                : "bg-slate-900 border-slate-800 text-slate-400"
            }`}
          >
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold font-mono text-slate-100 tracking-tight uppercase">
              RESERVATION SPACES
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Browse available MakerSpace schedules
            </div>
          </div>
        </div>

        <span
          className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${
            isAllSelected
              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
              : "bg-slate-900 text-slate-500 border-slate-800"
          }`}
        >
          {areas.length} SPACE{areas.length === 1 ? "" : "S"}
        </span>
      </motion.button>

      {/* Navigation chevron row for easy stepping */}
      <div className="flex items-center justify-between px-2 text-[10px] font-mono text-slate-500">
        <span>AREA_NAVIGATION_DECK</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Previous area"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleNext}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Next area"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Vertical Area Cards Container */}
      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-0.5">
        {areas.map((item) => {
          const isSelected = selectedAreaId === item.area.id;
          const { icon: Icon, eyebrow } = getAreaMeta(item.area.type);
          const status = getStatusDetails(item);
          const isQueueMode = item.area.bookingMode === "queue";

          if (isSelected) {
            // ==========================================
            // ACTIVE SPOTLIGHT CARD (Full Rich Detail)
            // ==========================================
            return (
              <motion.div
                key={item.area.id}
                layoutId={`card-${item.area.id}`}
                className="p-5 rounded-2xl border border-emerald-500/40 bg-slate-900/90 backdrop-blur-xl shadow-[0_0_30px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30 space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-mono tracking-widest text-slate-500">
                        {eyebrow}
                      </div>
                      <h3 className="text-base font-bold font-mono text-slate-100 tracking-tight">
                        {item.area.name}
                      </h3>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border tracking-tight ${status.color}`}
                  >
                    {status.label}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {item.area.description}
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/70">
                    <div className="text-[10px] text-slate-500 uppercase">
                      {isQueueMode ? "Machine State" : "Live In Use"}
                    </div>
                    <div className="text-sm font-bold text-slate-100 mt-0.5">
                      {isQueueMode ? item.machineStatus || "idle" : `${item.usedCount} / ${item.area.maxCapacity}`}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/70">
                    <div className="text-[10px] text-slate-500 uppercase">
                      {isQueueMode ? "Queue Length" : "Seats Free"}
                    </div>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5">
                      {isQueueMode ? `${item.queueLength || 0} jobs` : `${item.remainingCapacity} seats`}
                    </div>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="pt-1">
                  {isQueueMode ? (
                    <Link
                      to={`/fabrication/${item.area.serviceType}`}
                      className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs rounded-lg transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Upload File & Enter Queue
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onBookArea(item.area)}
                      className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Book This Workspace
                    </button>
                  )}
                </div>
              </motion.div>
            );
          }

          // ========================================================
          // SUBMERGED / PEEKING CARD (Gradient Submerge Aesthetic)
          // ========================================================
          return (
            <motion.div
              key={item.area.id}
              layoutId={`card-${item.area.id}`}
              onClick={() => onSelectArea(item.area.id)}
              whileHover={{ scale: 0.99, opacity: 0.85 }}
              whileTap={{ scale: 0.97 }}
              className="group relative p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/60 backdrop-blur-sm cursor-pointer transition-all duration-300 opacity-45 hover:opacity-85 shadow-lg overflow-hidden"
              style={{
                // Gradient submerge effect: subtle vertical depth shading
                backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.4), rgba(2, 6, 23, 0.85))",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-slate-200 group-hover:border-slate-700 transition-colors shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 truncate">
                    <div className="text-xs font-bold font-mono text-slate-300 group-hover:text-slate-100 truncate">
                      {item.area.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">
                      {isQueueMode
                        ? `${item.queueLength || 0} in queue`
                        : `${item.remainingCapacity} seats free`}
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase border shrink-0 ${status.color}`}
                >
                  {status.label}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
