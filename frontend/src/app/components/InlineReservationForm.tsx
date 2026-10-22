import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Gauge,
  LogIn,
  Send,
  Sparkles,
  Users,
  AlertCircle,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../auth";
import { translateAreaName, translateErrorMessage, useLanguage } from "../i18n";
import { QuotaInfo } from "./QuotaInfo";

interface ReservationQuota {
  limit: number;
  used: number;
  remaining: number;
  slotMinutes: number;
  activeReservationCount: number;
}

interface InlineReservationFormProps {
  areaId: string;
  areaName: string;
  maxCapacity: number;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  quota?: ReservationQuota | null;
  onBack: () => void;
  onSuccess: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
  : "";

const DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES = 8 * 60;
const DEFAULT_QUOTA_SLOT_MINUTES = 30;

function getBusinessTimezoneOffsetMinutes() {
  const parsed = Number.parseInt(
    import.meta.env.VITE_BUSINESS_TIMEZONE_OFFSET_MINUTES ?? String(DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES),
    10
  );
  return Number.isFinite(parsed) ? parsed : DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES;
}

function parseBusinessDateTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const offsetMinutes = getBusinessTimezoneOffsetMinutes();
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - offsetMinutes * 60 * 1000);
}

function toBusinessIsoDateTime(date: string, time: string) {
  return parseBusinessDateTime(date, time).toISOString();
}

function getDurationMinutes(startTime: string, endTime: string) {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
}

export function InlineReservationForm({
  areaId,
  areaName,
  maxCapacity,
  initialDate = "",
  initialStartTime = "",
  initialEndTime = "",
  quota,
  onBack,
  onSuccess,
}: InlineReservationFormProps) {
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();
  const { lang, tx } = useLanguage();

  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [people, setPeople] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [plannedItemsInput, setPlannedItemsInput] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [when2meet, setWhen2meet] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Sync with prop updates from calendar clicks
  useEffect(() => {
    if (initialDate) setDate(initialDate);
    if (initialStartTime) setStartTime(initialStartTime);
    if (initialEndTime) setEndTime(initialEndTime);
  }, [initialDate, initialStartTime, initialEndTime]);

  const selectedPeople = Math.max(1, Number.parseInt(people, 10) || 1);
  const quotaSlotMinutes = quota?.slotMinutes ?? DEFAULT_QUOTA_SLOT_MINUTES;

  const selectedQuotaCost = useMemo(() => {
    if (!startTime || !endTime || quotaSlotMinutes <= 0) return 0;
    const duration = getDurationMinutes(startTime, endTime);
    if (duration <= 0) return 0;
    return Math.ceil(duration / quotaSlotMinutes) * selectedPeople;
  }, [startTime, endTime, quotaSlotMinutes, selectedPeople]);

  const quotaIssue = useMemo(() => {
    if (!quota) return null;
    if (selectedQuotaCost > quota.remaining) {
      return tx(
        `超過剩餘配額：此時段需要 ${selectedQuotaCost} 點配額，但您僅剩 ${quota.remaining} 點。`,
        `Exceeds remaining quota: this slot requires ${selectedQuotaCost} slots, but you only have ${quota.remaining} remaining.`
      );
    }
    return null;
  }, [quota, selectedQuotaCost, tx]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) {
      navigate("/login");
      return;
    }

    if (!date || !startTime || !endTime) {
      setError(tx("請選擇日期、開始時間與結束時間", "Please select date, start time, and end time"));
      return;
    }

    if (quotaIssue) {
      setError(quotaIssue);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const plannedItems = plannedItemsInput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((name) => ({ category: "other", name, quantity: 1 }));

      const payload = {
        areaId,
        participantCount: selectedPeople,
        purpose: purpose.trim(),
        plannedItems,
        when2meet: when2meet.trim() || undefined,
        project: projectNotes.trim() || undefined,
        startTime: toBusinessIsoDateTime(date, startTime),
        endTime: toBusinessIsoDateTime(date, endTime),
      };

      const response = await fetch(`${API_BASE_URL}/api/reservations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        if (
          response.status === 401 ||
          (response.status === 403 && typeof result?.error === "string" && result.error.toLowerCase().includes("suspended"))
        ) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("mks:auth-error", {
                detail: { status: response.status, message: result.error },
              })
            );
          }
        }
        throw new Error(result.error || tx("建立預約失敗", "Failed to create reservation"));
      }

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : tx("預約失敗", "Reservation failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl"
    >
      {/* Top Header with Back button */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {tx("返回區域列表", "BACK_TO_AREAS")}
        </button>

        <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
          {tx("預約表單", "RESERVATION_PANEL")}
        </span>
      </div>

      <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-5">
        <div>
          <h3 className="text-lg font-bold font-mono text-slate-100 tracking-tight">
            {translateAreaName(areaName, lang)}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 font-sans">
            {tx(
              `人數上限：最多 ${maxCapacity} 人。可於右側時間表點選起訖時段或按住拖曳來自動填入預約區間。`,
              `Capacity: ${maxCapacity} seats max. Click the first and last calendar slot, or drag across slots, to update the full time range.`
            )}
          </p>
        </div>

        {/* Success animation */}
        <AnimatePresence>
          {isSuccess ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-12 flex flex-col items-center justify-center text-center space-y-3"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h4 className="text-base font-bold font-mono text-slate-100">
                {tx("預約已送出", "RESERVATION SUBMITTED")}
              </h4>
              <p className="text-xs text-slate-400 max-w-xs">
                {tx(
                  "您的預約已送交管理員審核，正在更新時間表...",
                  "Your session is queued for administrative approval. Refreshing schedule..."
                )}
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
              {!isAuthenticated && (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 space-y-2">
                  <div className="font-semibold font-mono text-xs flex items-center gap-1.5 text-amber-300">
                    <LogIn className="w-3.5 h-3.5" />
                    {tx("需要登入", "AUTHENTICATION REQUIRED")}
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {tx(
                      "您可以瀏覽時間表，但必須先登入才能送出空間預約申請。",
                      "You can browse the calendar, but you must sign in to submit a reservation."
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    {tx("前往登入以預約", "SIGN IN TO RESERVE")}
                  </button>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-relaxed">{translateErrorMessage(error, lang)}</span>
                </div>
              )}

              {/* Quota overview */}
              {isAuthenticated && quota && (
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 font-mono space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                      {tx("配額使用量", "QUOTA USAGE")}
                    </span>
                    <span className={quota.remaining === 0 ? "text-rose-400" : "text-slate-200"}>
                      {tx(`剩餘 ${quota.remaining}/${quota.limit}`, `${quota.remaining}/{quota.limit} LEFT`)}
                    </span>
                  </div>
                  {selectedQuotaCost > 0 && (
                    <div className="text-[10px] text-slate-400">
                      {tx("本次預約所需配額：", "Cost for selected duration: ")}
                      <span className="text-emerald-300 font-bold">
                        {tx(`${selectedQuotaCost} 點`, `${selectedQuotaCost} slots`)}
                      </span>{" "}
                      ({tx(`${selectedPeople} 人`, `${selectedPeople} pax`)})
                    </div>
                  )}
                </div>
              )}

              {/* Date selection */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {tx("預約日期", "DATE")}
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {tx("開始時間", "START TIME")}
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {tx("結束時間", "END TIME")}
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* People count */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    {tx("使用人數", "PARTICIPANTS (PAX)")}
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">{tx(`上限：${maxCapacity}`, `Max: ${maxCapacity}`)}</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max={maxCapacity}
                  required
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Purpose */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-400">
                  {tx("借用目的／專題名稱", "PURPOSE / PROJECT")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={tx("例如：專題實作、團隊討論", "e.g. Capstone project work or team discussion")}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Planned Items */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-400">
                  {tx("預計使用工具／設備", "PLANNED TOOLS / EQUIPMENT")}
                </label>
                <textarea
                  rows={2}
                  placeholder={tx("例如：示波器、手工具（每行一項）", "e.g. Oscilloscope, hand tools (one item per line)")}
                  value={plannedItemsInput}
                  onChange={(e) => setPlannedItemsInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={submitting || !isAuthenticated || Boolean(quotaIssue)}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-tight rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? tx("送出預約中...", "SUBMITTING_RSVN...") : tx("確認送出預約", "CONFIRM_RESERVATION")}
                </button>

                <button
                  type="button"
                  onClick={onBack}
                  className="w-full py-2 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors cursor-pointer"
                >
                  {tx("取消", "Cancel")}
                </button>
              </div>
            </form>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
