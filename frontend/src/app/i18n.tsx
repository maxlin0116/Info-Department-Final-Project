import React, { createContext, useContext, useEffect, useState } from "react";
import { Globe } from "lucide-react";

export type Language = "zh" | "en";

interface LanguageContextValue {
  lang: Language;
  locale: string;
  isZh: boolean;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  tx: <T = string>(zh: T, en: T) => T;
}

const STORAGE_KEY = "mks-lang";

function loadInitialLanguage(): Language {
  if (typeof window === "undefined") return "zh";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "zh" || stored === "en") {
    return stored;
  }
  return "zh";
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(loadInitialLanguage);

  const setLang = (next: Language) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const toggleLang = () => {
    setLang(lang === "zh" ? "en" : "zh");
  };

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-TW" : "en";
  }, [lang]);

  function tx<T = string>(zh: T, en: T): T {
    return lang === "zh" ? zh : en;
  }

  return (
    <LanguageContext.Provider
      value={{
        lang,
        locale: lang === "zh" ? "zh-TW" : "en-US",
        isZh: lang === "zh",
        setLang,
        toggleLang,
        tx,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-slate-700/80 bg-slate-900/90 p-0.5 text-xs font-mono ${className}`}
      role="group"
      aria-label="Language switcher"
    >
      <Globe className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1 shrink-0" />
      <button
        type="button"
        onClick={() => setLang("zh")}
        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
          lang === "zh"
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
            : "text-slate-400 hover:text-slate-200 border border-transparent"
        }`}
      >
        中文
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
          lang === "en"
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
            : "text-slate-400 hover:text-slate-200 border border-transparent"
        }`}
      >
        EN
      </button>
    </div>
  );
}

export function translateAreaName(name: string | undefined, lang: Language): string {
  if (!name) return "";
  if (lang === "en") {
    const toEn: Record<string, string> = {
      "創客空間": "MakerSpace",
      "3D 列印區": "3DP Area",
      "重型加工區": "Heavy Processing Area",
      "焊接區": "Soldering Area",
    };
    return toEn[name] || name;
  }
  const toZh: Record<string, string> = {
    "MakerSpace": "MakerSpace 創客空間",
    "3DP Area": "3DP 列印區",
    "Heavy Processing Area": "重型加工區",
    "Soldering Area": "電子焊接區",
    "Soldering Table": "電子焊接桌",
  };
  return toZh[name] || name;
}

export function translateAreaDescription(description: string | undefined, lang: Language): string {
  if (!description) return "";
  if (lang === "en") return description;
  const toZh: Record<string, string> = {
    "Reserve the MakerSpace for project work, discussion, and equipment use":
      "預約 MakerSpace 進行專題製作、團隊討論與設備使用",
    "For 3D printing reservations": "提供 3D 列印切片與佇列送件服務",
    "For heavy processing or machining work": "提供雷射切割與重型加工排程服務",
  };
  return toZh[description] || description;
}

export function translateDayLabel(dayLabel: string | undefined, lang: Language): string {
  if (!dayLabel) return "";
  if (lang === "en") return dayLabel;
  const toZh: Record<string, string> = {
    Sun: "週日",
    Mon: "週一",
    Tue: "週二",
    Wed: "週三",
    Thu: "週四",
    Fri: "週五",
    Sat: "週六",
  };
  return toZh[dayLabel] || dayLabel;
}

export function translateGrade(grade: string | undefined, lang: Language): string {
  if (!grade) return "";
  if (lang === "en") {
    const toEn: Record<string, string> = {
      "大一": "Freshman",
      "大二": "Sophomore",
      "大三": "Junior",
      "大四": "Senior",
      "碩士班": "Master's",
      "博士班": "PhD",
    };
    return toEn[grade] || grade;
  }
  const toZh: Record<string, string> = {
    Freshman: "大一",
    Sophomore: "大二",
    Junior: "大三",
    Senior: "大四",
    "Master's": "碩士班",
    Masters: "碩士班",
    PhD: "博士班",
  };
  return toZh[grade] || grade;
}

export function translateErrorMessage(message: string | undefined | null, lang: Language): string {
  if (!message) return "";
  if (lang === "en") return message;
  const toZh: Record<string, string> = {
    "Account has been suspended. Please contact MakerSpace administration.":
      "您的帳號已被停權，請聯絡 MakerSpace 管理員。",
    "Authentication required": "需要登入驗證",
    "Invalid or expired session": "登入階段無效或已過期，請重新登入",
    "Invalid student ID or password": "學號或密碼錯誤",
    "Access denied": "存取被拒",
    "Please upload a file": "請上傳檔案",
    "Please provide a job name": "請提供任務名稱",
  };
  return toZh[message] || message;
}

