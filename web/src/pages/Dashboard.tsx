import { useState } from 'react';
import {
    Activity, Zap, Play, RefreshCw, Pause, AlertTriangle,
    BookOpen, Users, MessageSquareWarning, User, Clock,
    LayoutDashboard, ArrowRight, CheckCircle2
} from 'lucide-react';
import { useEngineProgress } from '../hooks/useEngineProgress';
import { workspacesApi, auditLogApi, type AuditLogEntry } from '../lib/api';
import { useAuth } from '../store/AuthContext';
import { useView } from '../store/ViewContext';
import { useMutation, useQuery } from '@tanstack/react-query';
import { cn } from '../lib/utils';

export function Dashboard() {
    const { workspace } = useAuth();
    const { setView } = useView();
    const [taskId, setTaskId] = useState<string | null>(null);
    const [showGA, setShowGA] = useState(false);

    const engine = useEngineProgress(taskId);

    const generateMutation = useMutation({
        mutationFn: async () => {
            if (!workspace) throw new Error("No workspace selected");
            const { data } = await workspacesApi.generate(workspace.id, {
                population_size: 50,
                generations: 100
            });
            return data.task_id;
        },
        onSuccess: (newTaskId) => setTaskId(newTaskId),
    });

    const isRunning = engine.isPolling || engine.state === 'RUNNING';

    const { data: auditLogs } = useQuery({
        queryKey: ['audit-log', workspace?.id],
        queryFn: () => auditLogApi.list(workspace?.id),
        select: (res) => (res.data as AuditLogEntry[]).slice(0, 10),
        enabled: !!workspace?.id,
    });

    const formatTime = (ts: string) =>
        new Date(ts).toLocaleString('en-US', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

    const quickLinks = [
        {
            label: 'Manage Resources',
            desc: 'Rooms, Lecturers & Courses',
            icon: BookOpen,
            color: 'from-sky-500/20 to-sky-600/10 border-sky-500/20 text-sky-400',
            view: 'resources' as const,
        },
        {
            label: 'Generate Timetable',
            desc: 'Run optimization engine',
            icon: Zap,
            color: 'from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-400',
            view: null,
            action: () => setShowGA(true),
        },
        {
            label: 'Timetable Officers',
            desc: 'Register & manage staff',
            icon: Users,
            color: 'from-violet-500/20 to-violet-600/10 border-violet-500/20 text-violet-400',
            view: 'officers' as const,
        },
        {
            label: 'Feedback',
            desc: 'Staff complaints & responses',
            icon: MessageSquareWarning,
            color: 'from-rose-500/20 to-rose-600/10 border-rose-500/20 text-rose-400',
            view: 'complaints' as const,
        },
    ];

    return (
        <div className="space-y-6 sm:space-y-8">

            {/* ── Active Session Banner ─────────────────────── */}
            <div className="bg-gradient-to-r from-sky-900/40 to-indigo-900/40 border border-sky-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                        <LayoutDashboard className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                        <p className="text-xs text-sky-400/80 font-semibold uppercase tracking-widest mb-0.5">Active Academic Management Session</p>
                        <h2 className="text-xl font-bold text-slate-100">
                            {workspace?.name ?? 'No session selected'}
                        </h2>
                        <p className="text-slate-400 text-sm mt-0.5">Current active workspace for scheduling</p>
                    </div>
                </div>
                {workspace && (
                    <div className="flex items-center gap-2">
                        <div className="gc-led gc-led-success" />
                        <span className="text-emerald-400 text-sm font-medium">Session Active</span>
                    </div>
                )}
            </div>

            {/* ── Quick Links Grid ──────────────────────────── */}
            <div>
                <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">Quick Links</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {quickLinks.map((link) => {
                        const Icon = link.icon;
                        return (
                            <button
                                key={link.label}
                                onClick={() => link.view ? setView(link.view) : link.action?.()}
                                className={cn(
                                    "text-left p-5 rounded-2xl border bg-gradient-to-br transition-all hover:scale-[1.02] hover:shadow-lg group",
                                    link.color
                                )}
                            >
                                <Icon className="w-6 h-6 mb-4" />
                                <p className="text-slate-200 font-semibold text-sm">{link.label}</p>
                                <p className="text-slate-500 text-xs mt-1">{link.desc}</p>
                                <ArrowRight className="w-4 h-4 mt-3 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Audit Log Feed & GA Status ────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Audit Log Feed */}
                <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
                        <h3 className="text-slate-200 font-semibold text-sm flex items-center gap-2">
                            <Activity className="w-4 h-4 text-sky-400" />
                            Recent Activity
                        </h3>
                        <button
                            onClick={() => setView('audit-log')}
                            className="text-xs text-sky-400 hover:text-sky-300 gap-1 flex items-center"
                        >
                            View All <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                    {!auditLogs || auditLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-600 text-sm">
                            <Clock className="w-8 h-8 mb-3 opacity-30" />
                            No recent activity.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/50">
                            {auditLogs.map(entry => (
                                <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                                        <User className="w-3.5 h-3.5 text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-slate-300 text-sm truncate">
                                            <span className="text-sky-400 font-medium">{entry.actor_name}</span>
                                            {' — '}{entry.action}
                                        </p>
                                        <p className="text-slate-600 text-xs mt-0.5">{formatTime(entry.timestamp)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* GA Engine Panel */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
                        <h3 className="text-slate-200 font-semibold text-sm flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-400" />
                            GA Engine
                        </h3>
                        <button
                            onClick={() => setShowGA(!showGA)}
                            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            {showGA ? 'Collapse' : 'Expand'}
                        </button>
                    </div>

                    {showGA ? (
                        <div className="flex-1 p-4 space-y-4">
                            {(engine.error || generateMutation.error) && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-center gap-2 text-xs">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    {engine.error || (generateMutation.error as Error)?.message}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3 text-center">
                                {[
                                    { label: 'Fitness', val: engine.fitness.toFixed(4) },
                                    { label: 'Generation', val: engine.generation },
                                    { label: 'Progress', val: `${engine.progress}%` },
                                    { label: 'Status', val: engine.state },
                                ].map(m => (
                                    <div key={m.label} className="bg-slate-800/50 rounded-xl p-3">
                                        <p className="text-slate-500 text-xs">{m.label}</p>
                                        <p className="text-slate-100 font-bold text-base mt-1">{m.val}</p>
                                    </div>
                                ))}
                            </div>
                            {isRunning && (
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-sky-500 transition-all duration-500" style={{ width: `${engine.progress}%` }} />
                                </div>
                            )}
                            {engine.state === 'COMPLETED' && (
                                <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Optimization Complete!
                                </div>
                            )}
                            <button
                                onClick={() => isRunning ? setTaskId(null) : generateMutation.mutate()}
                                disabled={generateMutation.isPending}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm text-white transition-all",
                                    isRunning ? "bg-amber-600 hover:bg-amber-500" : "bg-sky-600 hover:bg-sky-500",
                                    generateMutation.isPending && "opacity-70 cursor-wait"
                                )}
                            >
                                {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                {generateMutation.isPending ? 'Starting...' : isRunning ? 'Stop' : 'Run Optimization'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-600">
                            <RefreshCw className="w-8 h-8 mb-3 opacity-30" />
                            <p className="text-sm">Click Expand to manage the optimization engine.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
