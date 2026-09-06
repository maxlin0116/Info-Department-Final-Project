import { Info } from "lucide-react";

export function QuotaInfo() {
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        aria-label="Reservation quota calculation"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span className="pointer-events-none absolute right-0 top-7 z-30 hidden w-72 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-[11px] font-normal normal-case leading-5 tracking-normal text-slate-300 shadow-2xl group-hover:block group-focus-within:block">
        Quota cost = ceil(duration / 30 min) x participants. Pending and approved future
        reservations use quota. Cancelled, rejected, and ended reservations do not.
      </span>
    </span>
  );
}
