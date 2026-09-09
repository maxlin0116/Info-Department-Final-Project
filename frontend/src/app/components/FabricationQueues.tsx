import { useEffect, useState } from "react";
import { Clock3, Printer, Scissors } from "lucide-react";
import { apiUrl, readApi } from "../api";
import type { FabricationJob, ServiceType } from "../fabricationTypes";
import { fabricationStatusLabel, formatDateTime, formatMinutes } from "../fabricationTypes";

const waitingReviewStatuses = ["pending_admin_estimate", "pending_admin_review"];

function statusStyle(status: string) {
  if (status === "running") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "queued") return "border-violet-500/30 bg-violet-500/10 text-violet-300";
  if (status === "completed") return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

function statusMark(job: FabricationJob) {
  if (job.status === "running") return "RUN";
  if (job.status === "queued") return `#${job.position}`;
  if (job.status === "completed") return "OK";
  return "WAIT";
}

function timingText(job: FabricationJob) {
  if (job.status === "running") return `預計完成 ${formatDateTime(job.expectedEndAt)}`;
  if (job.status === "queued") return `預計開始 ${formatDateTime(job.estimatedStartAt)}`;
  if (job.status === "completed") return `完成於 ${formatDateTime(job.completedAt)} · 等待取件確認`;
  return "檔案已送出，等待管理員確認";
}

export function FabricationQueues({ compact = false }: { compact?: boolean }) {
  const [queues, setQueues] = useState<Record<ServiceType, FabricationJob[]>>({ "3dp": [], laser: [] });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await readApi<{ queues: Record<ServiceType, FabricationJob[]> }>(await fetch(apiUrl("/api/fabrication/queues")));
        setQueues(data.queues);
      } catch { /* retain the last successful queue snapshot */ }
    };
    void load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return <div className={`grid ${compact ? "xl:grid-cols-2" : "lg:grid-cols-2"} gap-5`}>
    {(["laser", "3dp"] as ServiceType[]).map((type) => {
      const jobs = queues[type];
      const reviewCount = jobs.filter((item) => waitingReviewStatuses.includes(item.status)).length;
      const queueCount = jobs.filter((item) => item.status === "queued").length;
      const completedCount = jobs.filter((item) => item.status === "completed").length;
      return <section key={type} className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <header className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          {type === "3dp" ? <Printer className="text-sky-400" /> : <Scissors className="text-amber-400" />}
          <div>
            <h2 className="font-mono text-slate-100">{type === "3dp" ? "P1S Queue" : "Laser Queue"}</h2>
            <p className="text-xs text-slate-500">等待審核 {reviewCount} · 排隊 {queueCount} · 待取件 {completedCount}</p>
          </div>
        </header>
        <div className="divide-y divide-slate-800 max-h-[620px] overflow-y-auto">
          {jobs.length === 0 ? <p className="p-8 text-center text-slate-500">目前沒有工作</p> : jobs.map((job) => <div key={job.id} className="p-4 flex gap-4">
            <div className={`w-12 h-10 rounded-lg border grid place-items-center text-xs font-mono ${statusStyle(job.status)}`}>{statusMark(job)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="truncate font-medium text-slate-100">{job.title}</h3>
                <div className="flex items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusStyle(job.status)}`}>{fabricationStatusLabel(job.status)}</span><span className="text-xs text-slate-500">{formatMinutes(job.estimatedMinutes)}</span></div>
              </div>
              <p className="text-xs text-slate-500 mt-1">{job.user?.name || "Maker"} · {job.assignedColor || job.material || ""}</p>
              <p className="flex items-center gap-1 mt-2 text-xs text-slate-400"><Clock3 className="w-3 h-3" />{timingText(job)}</p>
            </div>
          </div>)}
        </div>
      </section>;
    })}
  </div>;
}
