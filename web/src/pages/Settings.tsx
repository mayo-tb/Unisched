import { Sliders, ShieldAlert, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

export function Settings() {
    return (
        <div className="space-y-6 sm:space-y-8">
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-3">
                    <Sliders className="text-sky-500 shrink-0" />
                    Engine Configuration
                </h2>
                <p className="text-slate-400 mt-1 text-sm sm:text-base">Fine-tune the genetic algorithm weights and constraints.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {/* Weights */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        Penalty Weights
                    </h3>
                    <div className="space-y-6">
                        {[
                            { label: 'Hard Conflict Penalty', value: 1000, desc: 'Double bookings, unavailable slots' },
                            { label: 'Soft Conflict Penalty', value: 10, desc: 'Capacity mismatch, preference ignored' },
                            { label: 'Preference Bonus', value: 5, desc: 'Lecturer preferred slot met' }
                        ].map((s) => (
                            <div key={s.label}>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium text-slate-300">{s.label}</label>
                                    <span className="text-xs font-mono text-sky-400">{s.value}</span>
                                </div>
                                <input type="range" className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                <p className="text-xs text-slate-500 mt-1.5">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Toggles */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-500" />
                        Active Constraints
                    </h3>
                    <div className="space-y-4">
                        {[
                            'Avoid 3 consecutive lectures for students',
                            'Respect "Mandatory Break" hours',
                            'Minimize room traversal distance',
                            'Group specific subjects in same room'
                        ].map((c, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/30 border border-slate-800/50">
                                <span className="text-sm text-slate-300">{c}</span>
                                <div className={cn(
                                    "w-10 h-6 rounded-full p-1 cursor-pointer transition-colors",
                                    i < 2 ? "bg-emerald-500/20" : "bg-slate-800"
                                )}>
                                    <div className={cn(
                                        "w-4 h-4 rounded-full shadow-sm transition-all",
                                        i < 2 ? "bg-emerald-500 translate-x-4" : "bg-slate-500 translate-x-0"
                                    )} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
