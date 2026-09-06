import { FormEvent, useState } from "react";
import { Navigate } from "react-router";
import { AlertCircle, CheckCircle2, KeyRound, Mail, Save, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useAuth } from "../auth";
import { PasswordInput } from "./PasswordInput";

export function AccountSettings() {
  const { user, isAuthenticated, changePassword, requestPasswordReset } = useAuth();
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
      setError("Please enter both current password and new password");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from the current password");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("PASSWORD_UPDATED");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Password update failed");
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
      setEmailSuccess("RESET_EMAIL_SENT");
    } catch (submitError) {
      setEmailError(submitError instanceof Error ? submitError.message : "Password reset request failed");
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
        <h1 className="text-2xl font-semibold text-slate-100 font-mono tracking-tight">Account Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your MakerSpace reservation account.</p>
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
              <h2 className="text-sm font-semibold text-slate-100 font-mono uppercase">Profile</h2>
              <p className="text-xs text-slate-500 font-mono">{user?.role ?? "user"}</p>
            </div>
          </div>

          <dl className="space-y-4">
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Name</dt>
              <dd className="mt-1 text-sm text-slate-100">{user?.name}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Student ID</dt>
              <dd className="mt-1 text-sm text-slate-100 font-mono">{user?.studentId}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Email</dt>
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
              <h2 className="text-lg font-semibold text-slate-100 font-mono">Password</h2>
              <p className="text-sm text-slate-500">Update login credentials.</p>
            </div>
          </div>

          <form className="p-5 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Current Password</label>
              <PasswordInput
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Current password"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">New Password</label>
                <PasswordInput
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New password"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Confirm Password</label>
                <PasswordInput
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm password"
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
              {submitting ? "UPDATING..." : "UPDATE_PASSWORD"}
            </button>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">Email Reset Link</div>
                  <div className="mt-1 text-xs text-slate-500 break-words">{user?.personalEmail}</div>
                </div>
                <button
                  type="button"
                  onClick={handleEmailReset}
                  disabled={emailSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {emailSubmitting ? "SENDING..." : "SEND_EMAIL"}
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
