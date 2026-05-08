import { useMemo } from "react";
import { Link } from "react-router";
import {
  CalendarClock,
  ChevronLeft,
  Users,
  XCircle,
  History as HistoryIcon,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useAuth } from "../auth";

interface ReservationArea {
  id: string;
  name: string;
  type: string;
}

interface PlannedItem {
  category: string;
  name: string;
  quantity: number;
}

interface ReservationItem {
  id: string;
  area: ReservationArea;
  participantCount: number;
  purpose: string;
  plannedItems: PlannedItem[];
  when2meet: string;
  project: string;
  startTime: string;
  endTime: string;
  status: "approved" | "pending" | "rejected" | "cancelled";
}

interface HistoryProps {
  reservations: ReservationItem[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
}

const formatReservationDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const formatPlannedItems = (items: PlannedItem[]) =>
  items
    .filter((item) => item && item.name)
    .map((item) => `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}`)
    .join(", ");

const getReservationStatusLabel = (reservation: ReservationItem, now: Date) => {
  if (reservation.status === "cancelled") return "Cancelled";
  if (reservation.status === "rejected") return "Rejected";
  if (reservation.status === "pending") return "Pending";

  const startTime = new Date(reservation.startTime);
  const endTime = new Date(reservation.endTime);

  if (now < startTime) return "Upcoming";
  if (now >= startTime && now < endTime) return "In Progress";
  return "Completed";
};

const getReservationStatusClassName = (status: string) => {
  switch (status) {
    case "Upcoming": return "text-sky-300 bg-sky-500/10 border-sky-500/30";
    case "In Progress": return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
    case "Completed": return "text-slate-300 bg-slate-500/10 border-slate-500/30";
    case "Pending": return "text-amber-300 bg-amber-500/10 border-amber-500/30";
    case "Rejected": return "text-rose-300 bg-rose-500/10 border-rose-500/30";
    case "Cancelled": return "text-slate-400 bg-slate-800/70 border-slate-700";
    default: return "text-slate-300 bg-slate-500/10 border-slate-500/30";
  }
};

export function ReservationHistory({ reservations, loading, error, onBack }: HistoryProps) {
  const { isAuthenticated } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const now = useMemo(() => new Date(), []);

  const historyReservations = useMemo(() => {
    return reservations
      .map((r) => ({
        ...r,
        derivedStatus: getReservationStatusLabel(r, now),
      }))
      .filter((r) => 
        r.status === "cancelled" || 
        r.status === "rejected" || 
        r.derivedStatus === "Completed"
      );
  }, [reservations, now]);

  if (!isAuthenticated) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 font-mono">AUTH_REQUIRED: Please login to view history.</p>
        <Link to="/login" className="mt-4 inline-block text-emerald-400 font-mono hover:underline">GOTO_LOGIN</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors font-mono text-sm group cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          BACK_TO_DASHBOARD
        </button>
        <div className="flex items-center gap-2 text-slate-500 font-mono text-xs uppercase tracking-widest">
          <HistoryIcon className="w-4 h-4" />
          Archive_Database
        </div>
      </div>

      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden backdrop-blur-sm"
      >
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/20">
          <h2 className="text-lg font-semibold text-slate-100 font-mono tracking-tight">Reservation History</h2>
          <p className="text-sm text-slate-500 mt-1 font-sans">Archived records of past terminal sessions.</p>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-slate-500 font-mono animate-pulse">QUERYING_ARCHIVE...</div>
        ) : error ? (
          <div className="px-5 py-8 text-amber-200 bg-amber-500/10 border-t border-amber-500/20 font-mono text-sm">{error}</div>
        ) : historyReservations.length === 0 ? (
          <div className="px-5 py-20 text-center text-slate-500 font-mono italic">NO_ARCHIVED_RESERVATIONS_FOUND</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {historyReservations.map((reservation, i) => (
              <motion.div
                key={reservation.id}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-slate-800/10 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-300 font-mono">{reservation.area.name}</h3>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-mono font-medium uppercase opacity-70 ${getReservationStatusClassName(reservation.derivedStatus)}`}>
                      {reservation.derivedStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {formatReservationDate(reservation.startTime)} - {formatReservationDate(reservation.endTime)}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 opacity-60">
                    <p className="text-[11px] text-slate-500">
                      <Users className="w-3 h-3 inline mr-1" />
                      {reservation.participantCount} pax
                    </p>
                    {reservation.purpose && <p className="text-[11px] text-slate-500 italic">"{reservation.purpose}"</p>}
                  </div>
                </div>
                <div className="text-[10px] text-slate-700 font-mono lg:text-right">
                  ID: {reservation.id.slice(-8)}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
