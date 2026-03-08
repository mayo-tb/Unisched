import { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { Zap, ArrowRight, Loader2, AlertCircle, User, Lock, IdCard } from 'lucide-react';

type PortalTab = 'admin' | 'staff';
type StaffMode = 'login' | 'signup';

export function LoginOverlay() {
    const { login, error } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<PortalTab>('admin');

    // Admin login
    const [adminUsername, setAdminUsername] = useState('');
    const [adminPassword, setAdminPassword] = useState('');

    // Staff login / signup
    const [staffMode, setStaffMode] = useState<StaffMode>('login');
    const [staffId, setStaffId] = useState('');
    const [staffPassword, setStaffPassword] = useState('');
    const [staffFullName, setStaffFullName] = useState('');

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminUsername.trim() || !adminPassword.trim()) return;
        setIsLoading(true);
        await login(adminUsername.trim(), adminPassword.trim());
        setIsLoading(false);
    };

    const handleStaffLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!staffId.trim() || !staffPassword.trim()) return;
        setIsLoading(true);
        if (staffMode === 'signup') {
            if (!staffFullName.trim()) { setIsLoading(false); return; }
            try {
                const { authApi } = await import('../lib/api');
                await authApi.register({
                    full_name: staffFullName.trim(),
                    staff_id: staffId.trim(),
                    password: staffPassword.trim(),
                    role: 'LECTURER',
                });
                // After successful registration, log in automatically
                await login(staffId.trim(), staffPassword.trim());
            } catch (err: any) {
                console.error('Registration failed:', err);
            }
        } else {
            await login(staffId.trim(), staffPassword.trim());
        }
        setIsLoading(false);
    };

    const inputClass =
        "w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/25 transition-all disabled:opacity-50";

    return (
        <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-[100]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-slate-950 to-slate-950" />

            <div className="relative w-full max-w-md p-8">
                {/* Branding */}
                <div className="text-center mb-10">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-sky-900/50 mb-6">
                        <Zap className="w-8 h-8 text-white fill-current" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">UniSched</h1>
                    <p className="text-slate-400">University Timetable Scheduling System</p>
                </div>

                {/* Login Card */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
                    {/* Portal Tabs */}
                    <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl mb-6">
                        <button
                            onClick={() => setActiveTab('admin')}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'admin'
                                ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/30'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            🛡️ Admin Portal
                        </button>
                        <button
                            onClick={() => setActiveTab('staff')}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'staff'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            👨‍🏫 Staff Portal
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* ── Admin Tab ──────────────────── */}
                    {activeTab === 'admin' && (
                        <form onSubmit={handleAdminLogin} className="space-y-4">
                            <div>
                                <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">
                                    Username
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        value={adminUsername}
                                        onChange={(e) => setAdminUsername(e.target.value)}
                                        placeholder="Enter admin username"
                                        disabled={isLoading}
                                        autoComplete="username"
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="password"
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        placeholder="Enter password"
                                        disabled={isLoading}
                                        autoComplete="current-password"
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading || !adminUsername.trim() || !adminPassword.trim()}
                                className="w-full group p-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-900/30"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    <>Sign In as Admin <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </button>
                        </form>
                    )}

                    {/* ── Staff Tab ──────────────────── */}
                    {activeTab === 'staff' && (
                        <form onSubmit={handleStaffLogin} className="space-y-4">
                            {staffMode === 'signup' && (
                                <div>
                                    <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">
                                        Full Name
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input
                                            type="text"
                                            value={staffFullName}
                                            onChange={(e) => setStaffFullName(e.target.value)}
                                            placeholder="e.g. Dr. John Smith"
                                            disabled={isLoading}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">
                                    Staff ID
                                </label>
                                <div className="relative">
                                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        value={staffId}
                                        onChange={(e) => setStaffId(e.target.value)}
                                        placeholder="e.g. STF001"
                                        disabled={isLoading}
                                        autoComplete="username"
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="password"
                                        value={staffPassword}
                                        onChange={(e) => setStaffPassword(e.target.value)}
                                        placeholder={staffMode === 'signup' ? 'Create a password (min 6 chars)' : 'Enter password'}
                                        disabled={isLoading}
                                        autoComplete={staffMode === 'signup' ? 'new-password' : 'current-password'}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !staffId.trim() || !staffPassword.trim() || (staffMode === 'signup' && !staffFullName.trim())}
                                className="w-full group p-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    <>
                                        {staffMode === 'signup' ? 'Create Account & Sign In' : 'Sign In as Lecturer'}
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStaffMode(staffMode === 'login' ? 'signup' : 'login')}
                                className="w-full text-center text-sm text-emerald-400 hover:text-emerald-300 transition-colors pt-2"
                            >
                                {staffMode === 'login'
                                    ? "New staff member? Sign Up"
                                    : "Already registered? Sign In"
                                }
                            </button>
                        </form>
                    )}

                    <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                        <p className="text-slate-600 text-xs">UniSched Identity • Role-Based Access Control</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
