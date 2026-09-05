import { FormEvent, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Cpu, Mail } from "lucide-react";
import { useAuth } from "../auth";

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await requestPasswordReset({ identifier: identifier.trim() });
      setSuccess(true);
      setIdentifier("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Password reset request failed");
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
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Reset Password</h1>
          <p className="text-slate-400 mt-2 text-sm">Send a reset link to your registered email.</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Student ID or Email</label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="b10901001 or student@example.com"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                If the account exists, a password reset email has been sent.
              </div>
            ) : null}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 font-mono uppercase"
              >
                <Mail className="w-4 h-4" />
                {submitting ? "SENDING..." : "SEND_RESET_LINK"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            <Link to="/login" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
