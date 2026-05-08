import { Outlet, Link, useLocation } from "react-router";
import { Cpu } from "lucide-react";
import { useAuth } from "../auth";

export function Layout() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link to="/" className="flex items-center gap-3 group min-w-0">
              <div className="p-2 bg-slate-900 rounded-lg group-hover:bg-slate-800 transition-colors border border-slate-800 group-hover:border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)] group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <Cpu className="w-5 h-5 text-emerald-400" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-100 truncate">
                MakerSpace <span className="text-slate-500 font-normal">Reservation System</span>
              </h1>
            </Link>

            {!isAuthPage ? (
              <div className="flex items-center gap-3 shrink-0">
                {isAuthenticated && user ? (
                  <>
                    {user.role === "admin" ? (
                      <Link
                        to="/admin/reservations"
                        className="px-4 py-2 text-sm font-medium text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-md hover:bg-amber-500/20 hover:border-amber-500/40 transition-all"
                      >
                        Admin Review
                      </Link>
                    ) : null}
                    <div className="hidden sm:block text-right">
                      <div className="text-sm font-medium text-slate-100">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.studentId}</div>
                    </div>
                    <button
                      type="button"
                      onClick={logout}
                      className="px-4 py-2 text-sm font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-md hover:bg-slate-800 hover:border-slate-600 transition-all"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="px-4 py-2 text-sm font-medium text-slate-300 border border-slate-700 rounded-md hover:bg-slate-900 hover:border-slate-600 transition-all"
                    >
                      Register
                    </Link>
                    <Link
                      to="/login"
                      className="px-4 py-2 text-sm font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-md hover:bg-emerald-400/20 hover:border-emerald-400/40 transition-all shadow-[0_0_15px_rgba(52,211,153,0.15)] hover:shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                    >
                      Login
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
