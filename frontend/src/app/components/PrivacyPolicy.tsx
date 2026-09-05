import { Link } from "react-router";
import { ArrowLeft, Database, KeyRound, Mail, ShieldCheck } from "lucide-react";

export function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-8">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </div>

      <div className="mb-8 flex items-center gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <ShieldCheck className="h-7 w-7 text-emerald-300" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-400">MakerSpace RSVN_SYS</p>
        </div>
      </div>

      <div className="space-y-8 text-sm leading-7 text-slate-300">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Database className="h-5 w-5 text-emerald-300" />
            Information We Store
          </h2>
          <p>
            MakerSpace RSVN_SYS stores account information required for reservation management,
            including name, grade, student ID, registered email address, hashed password, role, and
            reservation records. Password reset tokens are stored in hashed form and expire after a
            short time.
          </p>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Mail className="h-5 w-5 text-emerald-300" />
            Gmail API Use
          </h2>
          <p>
            This app uses the Gmail API only to send password reset emails from the configured
            MakerSpace sender Gmail account. It does not read, search, download, modify, or share
            Gmail mailbox content, contacts, labels, drafts, or attachments.
          </p>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <KeyRound className="h-5 w-5 text-emerald-300" />
            How Information Is Used
          </h2>
          <p>
            Stored information is used to authenticate users, manage MakerSpace reservations,
            enforce reservation quota rules, allow administrators to review reservations, and send
            account recovery emails. User information is not sold or used for advertising.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Data Sharing</h2>
          <p>
            The app sends the registered email address and password reset message content to the
            configured email provider only when a password reset is requested. Reservation and
            account data are not shared with other third parties except infrastructure providers
            required to run the service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Contact</h2>
          <p>
            For privacy or account questions, contact the project administrator at{" "}
            <a
              href="mailto:maxlin0116@gmail.com"
              className="text-emerald-400 hover:text-emerald-300"
            >
              maxlin0116@gmail.com
            </a>
            .
          </p>
        </section>

        <p className="border-t border-slate-800 pt-6 text-xs text-slate-500">
          Last updated: September 5, 2026
        </p>
      </div>
    </div>
  );
}
