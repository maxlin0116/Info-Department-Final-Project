import { Link } from "react-router";
import { Cpu, ShieldAlert, ArrowLeft } from "lucide-react";
import { useLanguage } from "../i18n";

export function Register() {
  const { tx } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 shadow-[0_0_25px_rgba(245,158,11,0.15)] mb-4">
            <Cpu className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            {tx("公開註冊已關閉", "Public Registration Closed")}
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-sm">
            {tx("MakerSpace 帳號現已改由管理員統一建立。", "MakerSpace account creation is now centralized.")}
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex items-start gap-3.5 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div className="text-xs leading-relaxed space-y-1">
              <div className="font-semibold text-amber-300">
                {tx("統一帳號核發", "Centralized Account Issuance")}
              </div>
              <p>
                {tx(
                  "學生與實驗室帳號皆由系辦與管理單位統一建立，網頁端不再開放自行註冊。",
                  "Student and laboratory accounts are uniformly provisioned by department administration. Self-registration via the web interface is no longer available."
                )}
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400 space-y-2 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
            <div className="font-semibold text-slate-300">{tx("如何啟用您的帳號：", "How to access your account:")}</div>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              <li>{tx("請查看學校信箱以取得初始登入資訊。", "Check your official student email for login credentials.")}</li>
              <li>{tx("使用您的學號與初始臨時密碼登入。", "Log in with your provided student ID and initial password.")}</li>
              <li>{tx("首次登入後系統會引導您設定個人新密碼。", "You will be prompted to set your personal password upon initial sign-in.")}</li>
            </ul>
          </div>

          <Link
            to="/login"
            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {tx("返回登入頁", "Back to Login")}
          </Link>
        </div>
      </div>
    </div>
  );
}
