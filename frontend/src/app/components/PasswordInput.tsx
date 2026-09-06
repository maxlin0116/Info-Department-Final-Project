import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  focusTone?: "emerald" | "amber";
};

const focusClassNames = {
  emerald: "focus:ring-emerald-500/50 focus:border-emerald-500/50",
  amber: "focus:ring-amber-500/50 focus:border-amber-500/50",
};

export function PasswordInput({ className = "", focusTone = "emerald", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`w-full px-4 py-2.5 pr-12 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 ${focusClassNames[focusTone]} transition-all ${className}`}
      />
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setVisible((nextVisible) => !nextVisible)}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  );
}
