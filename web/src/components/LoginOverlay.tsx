import { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { Zap, ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export function LoginOverlay() {
    const { login, error } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (role: 'admin' | 'faculty') => {
        setIsLoading(true);
        await login(role);
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-[100]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-slate-950 to-slate-950" />

            <div className="relative w-full max-w-md p-8">
                {/* Branding */}
                <div className="text-center mb-10">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-sky-900/50 mb-6">
                        <Zap className="w-8 h-8 text-white fill-current" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Genetics Cloud</h1>
                    <p className="text-slate-400">Next-Gen Timetable Optimization Engine</p>
                </div>

                {/* Login Card */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
                    <h2 className="text-slate-200 font-medium mb-6 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        Select Access Level
                    </h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-3">
                        <button
                            onClick={() => handleLogin('admin')}
                            disabled={isLoading}
                            className="w-full group p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-sky-500/50 transition-all text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div>
                                <div className="text-slate-200 font-medium group-hover:text-white">Admin Workspace</div>
                                <div className="text-slate-500 text-xs mt-0.5">Full control + Optimization Engine</div>
                            </div>
                            {isLoading ? <Loader2 className="w-5 h-5 text-sky-500 animate-spin" /> :
                                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-sky-400 transform group-hover:translate-x-1 transition-all" />}
                        </button>

                        <button
                            onClick={() => handleLogin('faculty')}
                            disabled={isLoading}
                            className="w-full group p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 transition-all text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div>
                                <div className="text-slate-200 font-medium group-hover:text-white">Faculty Portal</div>
                                <div className="text-slate-500 text-xs mt-0.5">View Schedules & Preferences</div>
                            </div>
                            {isLoading ? <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" /> :
                                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transform group-hover:translate-x-1 transition-all" />}
                        </button>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                        <p className="text-slate-600 text-xs">Protected by Genetics Cloud Identity™</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
