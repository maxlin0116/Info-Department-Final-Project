import { Link } from "react-router";
import { Cpu, ArrowRight } from "lucide-react";

export function Register() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 shadow-[0_0_20px_rgba(16,185,129,0.15)] mb-4">
            <Cpu className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Create an Account</h1>
          <p className="text-slate-400 mt-2 text-sm">Join the MakerSpace community</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Student ID</label>
              <input 
                type="text" 
                placeholder="e.g. 12345678"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <input 
                type="email" 
                placeholder="student@university.edu"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Username</label>
              <input 
                type="text" 
                placeholder="Choose a username"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Confirm Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit"
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2"
              >
                Sign Up
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
