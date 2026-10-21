import { Link } from "react-router";
import { ArrowLeft, Database, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useLanguage } from "../i18n";

export function PrivacyPolicy() {
  const { tx } = useLanguage();

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-8">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {tx("返回登入頁", "Back to login")}
        </Link>
      </div>

      <div className="mb-8 flex items-center gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <ShieldCheck className="h-7 w-7 text-emerald-300" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">{tx("隱私權政策", "Privacy Policy")}</h1>
          <p className="mt-2 text-sm text-slate-400">MakerSpace RSVN_SYS</p>
        </div>
      </div>

      <div className="space-y-8 text-sm leading-7 text-slate-300">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Database className="h-5 w-5 text-emerald-300" />
            {tx("我們儲存的資訊", "Information We Store")}
          </h2>
          <p>
            {tx(
              "MakerSpace RSVN_SYS 會儲存預約管理所需的帳號資訊，包含姓名、年級、學號、註冊電子郵件、雜湊加密後的密碼、身分權限及空間預約與加工紀錄。密碼重設權杖亦以雜湊形式儲存，並在短時間內自動過期。",
              "MakerSpace RSVN_SYS stores account information required for reservation management, including name, grade, student ID, registered email address, hashed password, role, and reservation records. Password reset tokens are stored in hashed form and expire after a short time."
            )}
          </p>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Mail className="h-5 w-5 text-emerald-300" />
            {tx("Gmail API 使用說明", "Gmail API Use")}
          </h2>
          <p>
            {tx(
              "本系統僅使用 Gmail API 由設定好的 MakerSpace 官方寄件信箱發送密碼重設信件。系統不會讀取、搜尋、下載、修改或分享任何信箱內容、聯絡人、標籤、草稿或附件。",
              "This app uses the Gmail API only to send password reset emails from the configured MakerSpace sender Gmail account. It does not read, search, download, modify, or share Gmail mailbox content, contacts, labels, drafts, or attachments."
            )}
          </p>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <KeyRound className="h-5 w-5 text-emerald-300" />
            {tx("資訊使用方式", "How Information Is Used")}
          </h2>
          <p>
            {tx(
              "所儲存之資訊僅用於驗證使用者身分、管理 MakerSpace 預約與加工佇列、執行配額規範、提供管理員審核預約，以及寄送帳號復原信件。使用者資料絕不會被出售或用於廣告用途。",
              "Stored information is used to authenticate users, manage MakerSpace reservations, enforce reservation quota rules, allow administrators to review reservations, and send account recovery emails. User information is not sold or used for advertising."
            )}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">{tx("資料分享原則", "Data Sharing")}</h2>
          <p>
            {tx(
              "僅在使用者申請重設密碼時，系統才會將註冊信箱與重設信件內容傳送至設定好的郵件服務商。除運行服務所需之基礎設施供應商外，預約與帳號資料不會與任何第三方分享。",
              "The app sends the registered email address and password reset message content to the configured email provider only when a password reset is requested. Reservation and account data are not shared with other third parties except infrastructure providers required to run the service."
            )}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">{tx("聯絡方式", "Contact")}</h2>
          <p>
            {tx("若有任何隱私權或帳號相關問題，請聯繫專案管理員：", "For privacy or account questions, contact the project administrator at")}{" "}
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
          {tx("最後更新日期：2026 年 9 月 5 日", "Last updated: September 5, 2026")}
        </p>
      </div>
    </div>
  );
}
