import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: ReactNode;
    trend?: string;
    trendUp?: boolean;
    description?: string;
    className?: string;
}

export function StatCard({ title, value, icon, trend, trendUp, description, className }: StatCardProps) {
    return (
        <div className={cn(
            "relative overflow-hidden rounded-2xl bg-slate-900/50 border border-slate-800 p-6 shadow-xl backdrop-blur-sm group hover:border-slate-700 transition-all duration-300",
            className
        )}>
            {/* Background Glow */}
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all duration-500" />

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
                    <div className="p-2 rounded-lg bg-slate-800/50 text-slate-300 group-hover:text-white group-hover:bg-sky-500/20 transition-colors">
                        {icon}
                    </div>
                </div>

                <div className="flex items-end gap-3 mb-2">
                    <span className="text-3xl font-bold text-slate-100 tracking-tight">{value}</span>
                    {trend && (
                        <span className={cn(
                            "text-sm font-medium px-2 py-0.5 rounded-full mb-1",
                            trendUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        )}>
                            {trend}
                        </span>
                    )}
                </div>

                {description && (
                    <p className="text-slate-500 text-xs font-mono">{description}</p>
                )}
            </div>
        </div>
    );
}
