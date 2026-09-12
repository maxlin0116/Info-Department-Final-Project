import { Outlet, Link, useLocation } from "react-router";
import { CalendarDays, Cpu, Home, KeyRound, Printer, Scissors } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useAuth } from "../auth";

export function Layout() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/reset-password" ||
    location.pathname === "/privacy";
  const shouldReduceMotion = useReducedMotion();
  const primaryTabs = [
    { to: "/", label: "首頁", icon: Home },
    { to: "/reserve", label: "預約空間", icon: CalendarDays },
    { to: "/fabrication/3dp", label: "3DP", icon: Printer },
    { to: "/fabrication/laser", label: "雷切", icon: Scissors },
  ];

  const isPrimaryTabActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <div className="min-h-screen bg-[#020617] text-[#F8FAFC] font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <motion.header
        initial={shouldReduceMotion ? { y: 0 } : { y: -64 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="border-b border-slate-800 bg-[#020617]/50 backdrop-blur-md sticky top-0 z-40"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link to="/" className="flex items-center gap-3 group min-w-0">
              <motion.div
                whileHover={shouldReduceMotion ? {} : { rotate: 5, scale: 1.05 }}
                className="p-2 bg-slate-900 rounded-lg group-hover:bg-slate-800 transition-colors border border-slate-800 group-hover:border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)] group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                <Cpu className="w-5 h-5 text-emerald-400" />
              </motion.div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-100 truncate font-mono">
                MakerSpace <span className="text-slate-500 font-normal opacity-70">RSVN_SYS</span>
              </h1>
            </Link>

            {!isAuthPage ? (
              <div className="flex items-center gap-3 shrink-0">
                <Link to="/fabrication/queues" className="hidden md:block text-sm font-mono text-slate-400 hover:text-emerald-300">QUEUES</Link>
                {isAuthenticated && user ? (
                  <>
                    <Link to="/fabrication/jobs" className="hidden md:block text-xs font-mono text-slate-400 hover:text-emerald-300">MY_JOBS</Link>
                    {user.role === "admin" ? (
                      <>
                        <Link
                          to="/admin/reservations"
                          className="hidden lg:inline-block px-3 py-2 text-xs font-mono font-medium text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-md hover:bg-amber-500/20 hover:border-amber-500/40 transition-all uppercase tracking-tighter"
                        >
                          RSVN_ADMIN
                        </Link>
                        <Link
                          to="/admin/fabrication"
                          className="px-3 py-2 text-xs font-mono font-medium text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-md hover:bg-amber-500/20 hover:border-amber-500/40 transition-all uppercase tracking-tighter"
                        >
                          FAB_ADMIN
                        </Link>
                        <Link
                          to="/admin/users"
                          className="px-3 py-2 text-xs font-mono font-medium text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 rounded-md hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all uppercase tracking-tighter"
                        >
                          USERS_ADMIN
                        </Link>
                      </>
                    ) : null}
                    <div className="hidden sm:block text-right">
                      <div className="text-xs font-mono font-bold text-slate-100 uppercase">{user.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">ID:{user.studentId}</div>
                    </div>
                    <Link
                      to="/account"
                      className="px-3 py-2 text-xs font-mono font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-md hover:bg-slate-800 hover:border-slate-600 transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      ACCOUNT
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="px-4 py-2 text-xs font-mono font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-md hover:bg-slate-800 hover:border-slate-600 transition-all cursor-pointer"
                    >
                      LOGOUT
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    className="px-4 py-2 text-xs font-mono font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-md hover:bg-emerald-400/20 hover:border-emerald-400/40 transition-all shadow-[0_0_15px_rgba(52,211,153,0.15)] hover:shadow-[0_0_20px_rgba(52,211,153,0.3)] uppercase"
                  >
                    LOGIN
                  </Link>
                )}
              </div>
            ) : null}
          </div>
          {!isAuthPage ? (
            <nav aria-label="主要功能" className="flex items-center gap-1 overflow-x-auto border-t border-slate-800/80 py-2 custom-scrollbar">
              {primaryTabs.map((tab) => {
                const Icon = tab.icon;
                const active = isPrimaryTabActive(tab.to);
                return (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                        : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>
      </motion.header>

      <motion.main
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      >
        <Outlet />
      </motion.main>
      <footer className="border-t border-slate-900 px-4 py-5 text-center text-xs text-slate-500">
        <Link to="/privacy" className="hover:text-emerald-300 transition-colors">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
