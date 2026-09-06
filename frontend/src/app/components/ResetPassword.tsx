import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, CheckCircle2, Cpu, KeyRound } from "lucide-react";
import { useAuth } from "../auth";
import { PasswordInput } from "./PasswordInput";

export function ResetPassword() {
  const { resetPassword, validatePasswordResetToken } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingToken, setCheckingToken] = useState(Boolean(token));
  const [tokenValid, setTokenValid] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "Password reset token is missing");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    if (!token) {
      setCheckingToken(false);
      setTokenValid(false);
      setError("Password reset token is missing");
      return () => {
        active = false;
      };
    }

    setCheckingToken(true);
    setTokenValid(false);
    setError(null);

    validatePasswordResetToken(token)
      .then((valid) => {
        if (!active) {
          return;
        }

        setTokenValid(valid);
        if (!valid) {
          setError("Password reset link is invalid or expired. Please request a new link.");
        }
      })
      .catch((validationError) => {
        if (!active) {
          return;
        }

        setTokenValid(false);
        setError(validationError instanceof Error ? validationError.message : "Could not validate reset link");
      })
      .finally(() => {
        if (active) {
          setCheckingToken(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!token) {
      setError("Password reset token is missing");
      return;
    }

    if (!tokenValid) {
      setError("Password reset link is invalid or expired. Please request a new link.");
      return;
    }

    if (!newPassword.trim()) {
      setError("Please enter a new password");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      await resetPassword({ token, newPassword });
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Password reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 shadow-[0_0_20px_rgba(16,185,129,0.15)] mb-4">
            <Cpu className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Set New Password</h1>
          <p className="text-slate-400 mt-2 text-sm">Complete your MakerSpace account recovery.</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {success ? (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-300" />
              </div>
              <h2 className="text-lg font-semibold text-slate-100 font-mono">PASSWORD_RESET_DONE</h2>
              <Link
                to="/login"
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-mono font-medium text-emerald-200 hover:bg-emerald-500/20 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                BACK_TO_LOGIN
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
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

              {error ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  {error}
                </div>
              ) : null}
              {checkingToken ? (
                <div className="rounded-lg border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                  Checking reset link...
                </div>
              ) : null}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || checkingToken || !token || !tokenValid}
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 font-mono uppercase"
                >
                  <KeyRound className="w-4 h-4" />
                  {checkingToken ? "CHECKING..." : submitting ? "UPDATING..." : "RESET_PASSWORD"}
                </button>
              </div>
            </form>
          )}

          {!success ? (
            <div className="mt-6 text-center text-sm text-slate-400">
              <Link to="/login" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
