import { useEffect, useState } from "react";
import {
  AlertCircle,
  Hammer,
  Plus,
  Printer,
  RefreshCw,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ReservationModal } from "./ReservationModal";

type Status = "available" | "occupied" | "maintenance";
type AreaType = "meeting" | "soldering" | "3dp" | "heavy_processing";

interface AreaSummary {
  id: string;
  name: string;
  type: AreaType;
  maxCapacity: number;
  description: string;
  showPrintingStatus: boolean;
  isActive: boolean;
}

interface AreaStatusItem {
  area: AreaSummary;
  usedCount: number;
  remainingCapacity: number;
  activeReservationCount: number;
  isFull: boolean;
  hasActivePrinting: boolean;
}

interface AreaStatusResponse {
  statuses: AreaStatusItem[];
}

interface AreaMeta {
  icon: LucideIcon;
  eyebrow: string;
}

const AREA_STATUS_ENDPOINT = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/areas/status`
  : "/api/areas/status";

const getStatusColor = (status: Status) => {
  switch (status) {
    case "available":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30 shadow-[0_0_15px_rgba(52,211,153,0.15)] ring-1 ring-emerald-400/20";
    case "occupied":
      return "text-rose-400 bg-rose-400/10 border-rose-400/30 shadow-[0_0_15px_rgba(251,113,133,0.15)] ring-1 ring-rose-400/20";
    case "maintenance":
      return "text-amber-400 bg-amber-400/10 border-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/20";
  }
};

const getStatusGlow = (status: Status) => {
  switch (status) {
    case "available":
      return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]";
    case "occupied":
      return "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]";
    case "maintenance":
      return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]";
  }
};

const getStatusLabel = (status: Status) => {
  switch (status) {
    case "available":
      return "Available";
    case "occupied":
      return "In Use";
    case "maintenance":
      return "Maintenance";
  }
};

const getAreaMeta = (type: AreaType): AreaMeta => {
  switch (type) {
    case "meeting":
      return { icon: Users, eyebrow: "Meeting & Collaboration" };
    case "soldering":
      return { icon: Hammer, eyebrow: "Electronics & Soldering" };
    case "3dp":
      return { icon: Printer, eyebrow: "3D Printing" };
    case "heavy_processing":
      return { icon: Zap, eyebrow: "Machining & Heavy Processing" };
  }
};

const getAreaStatusKind = (item: AreaStatusItem): Status => {
  if (!item.area.isActive) {
    return "maintenance";
  }

  if (item.isFull || item.hasActivePrinting) {
    return "occupied";
  }

  return "available";
};

const getAreaDetails = (item: AreaStatusItem) => {
  if (!item.area.isActive) {
    return "Temporarily unavailable";
  }

  if (item.area.showPrintingStatus) {
    return item.hasActivePrinting
      ? `Printing in progress · ${item.activeReservationCount} active job`
      : "No active print jobs";
  }

  return `${item.usedCount}/${item.area.maxCapacity} capacity currently reserved`;
};

function AreaCard({ item, onReserve }: { item: AreaStatusItem; onReserve: (area: AreaSummary) => void }) {
  const status = getAreaStatusKind(item);
  const { icon: Icon, eyebrow } = getAreaMeta(item.area.type);

  return (
    <div className={`relative p-5 rounded-xl border flex flex-col transition-all duration-300 ${getStatusColor(status)} group`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700 shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">{eyebrow}</p>
            <h3 className="font-semibold text-slate-100 truncate">{item.area.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{getAreaDetails(item)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium uppercase tracking-wider opacity-80 whitespace-nowrap">
            {getStatusLabel(status)}
          </span>
          <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusGlow(status)}`} />
        </div>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed mb-5">{item.area.description}</p>

      <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 mb-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-slate-500 uppercase tracking-widest text-[10px] mb-1">In Use</div>
          <div className="text-base font-semibold text-slate-100">
            {item.usedCount}/{item.area.maxCapacity}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-slate-500 uppercase tracking-widest text-[10px] mb-1">Remaining</div>
          <div className="text-base font-semibold text-slate-100">{item.remainingCapacity}</div>
        </div>
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-700/50 gap-3">
        <div className="text-xs text-slate-400">
          {item.area.showPrintingStatus
            ? item.hasActivePrinting
              ? "Printer is active"
              : "Printer is idle"
            : item.isFull
              ? "Area is full"
              : "Area accepts reservations"}
        </div>
        <button
          onClick={() => onReserve(item.area)}
          disabled={!item.area.isActive}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-all text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Reserve
        </button>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<AreaSummary | null>(null);
  const [areas, setAreas] = useState<AreaStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const handleReserve = (area: AreaSummary) => {
    setSelectedArea(area);
    setModalOpen(true);
  };

  useEffect(() => {
    let cancelled = false;

    const loadAreaStatuses = async () => {
      try {
        if (!cancelled) {
          setError(null);
        }

        const response = await fetch(AREA_STATUS_ENDPOINT);

        if (!response.ok) {
          throw new Error(`Area status request failed with ${response.status}`);
        }

        const payload = (await response.json()) as AreaStatusResponse;

        if (!Array.isArray(payload.statuses)) {
          throw new Error("Invalid area status response");
        }

        if (!cancelled) {
          setAreas(payload.statuses);
          setLastUpdated(
            new Intl.DateTimeFormat("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date())
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof TypeError
              ? "Cannot reach the backend API. Make sure the backend server is running on port 8000."
              : loadError instanceof Error
                ? loadError.message
                : "Failed to load area statuses";

          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAreaStatuses();
    const intervalId = window.setInterval(() => {
      void loadAreaStatuses();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshNonce]);

  return (
    <>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Area Status</h1>
            <p className="text-sm text-slate-400 mt-1">
              Live availability is now driven by the backend reservation data.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{lastUpdated ? `Updated ${lastUpdated}` : "Fetching latest status..."}</span>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Could not load live area status</div>
              <div className="text-amber-100/80 mt-1">{error}</div>
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-8 text-sm text-slate-400">
          Loading current area status...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {areas.map((item) => (
            <AreaCard key={item.area.id} item={item} onReserve={handleReserve} />
          ))}
        </div>
      )}

      <ReservationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        areaId={selectedArea?.id ?? null}
        resourceName={selectedArea?.name ?? ""}
        maxCapacity={selectedArea?.maxCapacity ?? 1}
        onReservationCreated={() => setRefreshNonce((current) => current + 1)}
      />
    </>
  );
}
