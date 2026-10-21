import { Info } from "lucide-react";
import { useLanguage } from "../i18n";

export function QuotaInfo() {
  const { tx } = useLanguage();

  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        aria-label={tx("預約配額計算說明", "Reservation quota calculation")}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span className="pointer-events-none absolute right-0 top-7 z-30 hidden w-72 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-[11px] font-normal normal-case leading-5 tracking-normal text-slate-300 shadow-2xl group-hover:block group-focus-within:block">
        {tx(
          "配額計算方式 = 無條件進位(時長 / 30 分鐘) × 人數。待審核與已核准的未來預約會佔用配額；已取消、已拒絕與已結束的預約則不佔用。",
          "Quota cost = ceil(duration / 30 min) x participants. Pending and approved future reservations use quota. Cancelled, rejected, and ended reservations do not."
        )}
      </span>
    </span>
  );
}
