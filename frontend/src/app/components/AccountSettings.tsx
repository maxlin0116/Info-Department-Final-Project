import { FormEvent, useState } from "react";
import { Navigate } from "react-router";
import { AlertCircle, CheckCircle2, KeyRound, Mail, Save, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";
import { PasswordInput } from "./PasswordInput";

export function AccountSettings() {
  const { user, isAuthenticated, changePassword, requestPasswordReset } = useAuth();
  const { tx } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword.trim()) {
      setError(tx("請輸入目前密碼與新密碼", "Please enter both current password and new password"));
      return;
    }

    if (currentPassword === newPassword) {
      setError(tx("新密碼不能與目前密碼相同", "New password must be different from the current password"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(tx("兩次輸入的密碼不一致", "Passwords do not match"));
      return;
    }

    setSubmitting(true);

    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(tx("密碼已更新", "PASSWORD_UPDATED"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : tx("密碼更新失敗", "Password update failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailReset = async () => {
    if (!user?.studentId) {
      return;
    }

    setEmailSubmitting(true);
    setEmailError(null);
    setEmailSuccess(null);

    try {
      await requestPasswordReset({ identifier: user.studentId });
      setEmailSuccess(tx("重設信件已寄出", "RESET_EMAIL_SENT"));
    } catch (submitError) {
      setEmailError(submitError instanceof Error ? submitError.message : tx("發送密碼重設信失敗", "Password reset request failed"));
    } finally {
      setEmailSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-semibold text-slate-100 font-mono tracking-tight">{tx("帳號設定", "Account Settings")}</h1>
        <p className="text-sm text-slate-400 mt-1">{tx("管理您的 MakerSpace 預約帳號與密碼。", "Manage your MakerSpace reservation account.")}</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-6">
        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 h-fit"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 font-mono uppercase">{tx("個人資料", "Profile")}</h2>
              <p className="text-xs text-slate-500 font-mono">{user?.role ?? "user"}</p>
            </div>
          </div>

          <dl className="space-y-4">
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">{tx("姓名", "Name")}</dt>
              <dd className="mt-1 text-sm text-slate-100">{user?.name}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">{tx("學號", "Student ID")}</dt>
              <dd className="mt-1 text-sm text-slate-100 font-mono">{user?.studentId}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">{tx("電子郵件", "Email")}</dt>
              <dd className="mt-1 text-sm text-slate-100 break-words">{user?.personalEmail}</dd>
            </div>
          </dl>
        </motion.section>

        <motion.section
          initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/20 flex items-center gap-3">
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <div>
              <h2 className="text-lg font-semibold text-slate-100 font-mono">{tx("密碼設定", "Password")}</h2>
              <p className="text-sm text-slate-500">{tx("更新您的登入密碼。", "Update login credentials.")}</p>
            </div>
          </div>

          {user?.mustChangePassword ? (
            <div className="m-5 mb-0 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-3 text-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <div className="font-bold text-amber-300 uppercase tracking-wide font-mono mb-0.5">{tx("請先更新密碼", "Password Update Required")}</div>
                {tx(
                  "您目前使用的是管理員核發的初始臨時密碼，請於下方設定新的個人密碼。",
                  "You are currently signed in with a temporary password provided by administration. Please set a new password below."
                )}
              </div>
            </div>
          ) : null}

          <form className="p-5 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">{tx("目前密碼", "Current Password")}</label>
              <PasswordInput
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder={tx("請輸入目前密碼", "Current password")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">{tx("新密碼", "New Password")}</label>
                <PasswordInput
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={tx("請輸入新密碼", "New password")}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">{tx("確認新密碼", "Confirm Password")}</label>
                <PasswordInput
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={tx("再次輸入新密碼", "Confirm password")}
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {success ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-center gap-2 font-mono">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 font-mono uppercase"
            >
              <Save className="w-4 h-4" />
              {submitting ? tx("更新中...", "UPDATING...") : tx("更新密碼", "UPDATE_PASSWORD")}
            </button>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">{tx("寄送密碼重設連結", "Email Reset Link")}</div>
                  <div className="mt-1 text-xs text-slate-500 break-words">{user?.personalEmail}</div>
                </div>
                <button
                  type="button"
                  onClick={handleEmailReset}
                  disabled={emailSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {emailSubmitting ? tx("寄送中...", "SENDING...") : tx("寄送重設信", "SEND_EMAIL")}
                </button>
              </div>

              {emailError ? (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {emailError}
                </div>
              ) : null}

              {emailSuccess ? (
                <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 font-mono">
                  {emailSuccess}
                </div>
              ) : null}
            </div>
          </form>
        </motion.section>
      </div>
    </div>
  );
}
