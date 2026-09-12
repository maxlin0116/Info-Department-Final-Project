import { Link } from "react-router";
import {
  Calendar,
  ChevronRight,
  Flame,
  Hammer,
  Layers,
  Printer,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";

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

interface AllAreasOverviewProps {
  areas: AreaStatusItem[];
  onSelectArea: (areaId: string) => void;
}

export function AllAreasOverview({ areas, onSelectArea }: AllAreasOverviewProps) {
  const scheduleAreas = areas.filter((a) => a.area.bookingMode !== "queue");
  const queueAreas = areas.filter((a) => a.area.bookingMode === "queue");

  return (
    <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl p-6 space-y-6 overflow-y-auto custom-scrollbar">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Layers className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold font-mono text-slate-100 tracking-tight uppercase">
              MakerSpace Reservation Status
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Live capacity and the five-day reservation schedule for bookable spaces.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>LIVE_MONITORING</span>
        </div>
      </div>

      {/* Schedulable Spaces Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-mono tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            SCHEDULED WORKSTATIONS
          </h3>
          <span className="text-[10px] font-mono text-slate-500">Click area to open full 5-day calendar</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scheduleAreas.map((item) => {
            const isSoldering = item.area.type === "soldering";
            const occupancyRate = Math.min(100, Math.round((item.usedCount / item.area.maxCapacity) * 100));

            return (
              <div
                key={item.area.id}
                onClick={() => onSelectArea(item.area.id)}
                className="group p-5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900/60 hover:border-slate-700 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:border-emerald-500/40 group-hover:text-emerald-400 transition-colors">
                      {isSoldering ? <Hammer className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-mono text-slate-100 group-hover:text-emerald-300 transition-colors">
                        {item.area.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.area.description}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${
                      item.isFull
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        : item.usedCount > 0
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {item.isFull ? "FULL" : item.usedCount > 0 ? "IN USE" : "AVAILABLE"}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Live Seat Occupancy</span>
                    <span className="text-slate-200 font-bold">
                      {item.usedCount} / {item.area.maxCapacity} seats ({occupancyRate}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        occupancyRate >= 90
                          ? "bg-rose-500"
                          : occupancyRate >= 50
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                      }`}
                      style={{ width: `${occupancyRate}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-emerald-400 group-hover:text-emerald-300">
                  <span className="text-[11px] text-slate-500">Open 5-day schedule & book &rarr;</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Queue & Fabrication Section */}
      {queueAreas.length > 0 ? <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-mono tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            FABRICATION QUEUES & TELEMETRY
          </h3>
          <Link
            to="/fabrication/queues"
            className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            VIEW_PUBLIC_QUEUE &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {queueAreas.map((item) => {
            const is3dp = item.area.type === "3dp";
            const machineStatus = item.machineStatus || "idle";

            return (
              <div
                key={item.area.id}
                onClick={() => onSelectArea(item.area.id)}
                className="group p-5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900/60 hover:border-slate-700 transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:border-amber-500/40 group-hover:text-amber-400 transition-colors">
                      {is3dp ? <Printer className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-mono text-slate-100 group-hover:text-amber-300 transition-colors">
                        {item.area.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {is3dp ? "Bambu Lab P1S (0.4mm PLA)" : "High-precision Laser Cutter"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${
                      machineStatus === "running"
                        ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                        : machineStatus === "idle"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    }`}
                  >
                    {machineStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-2.5 rounded-lg border border-slate-800/80 bg-slate-900/50">
                    <div className="text-[10px] text-slate-500 uppercase">Current Job</div>
                    <div className="text-slate-200 font-bold mt-0.5">
                      {item.hasActivePrinting ? "Printing Active" : "Machine Idle"}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-800/80 bg-slate-900/50">
                    <div className="text-[10px] text-slate-500 uppercase">Waitlist</div>
                    <div className="text-slate-200 font-bold mt-0.5">
                      {item.queueLength || 0} queued job(s)
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-cyan-400 group-hover:text-cyan-300">
                  <span className="text-[11px] text-slate-500">Upload file & enter queue &rarr;</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div> : null}
    </div>
  );
}
