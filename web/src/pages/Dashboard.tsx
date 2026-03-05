import { useState } from 'react';
import { Activity, Zap, Archive, Play, RefreshCw, Clock, Pause, AlertTriangle } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { cn } from '../lib/utils';
import { useEngineProgress } from '../hooks/useEngineProgress';
import { workspacesApi } from '../lib/api';
import { useAuth } from '../store/AuthContext';
import { useMutation } from '@tanstack/react-query';

export function Dashboard() {
    const { workspace } = useAuth();
    const [taskId, setTaskId] = useState<string | null>(null);

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
        onSuccess: (newTaskId) => {
            setTaskId(newTaskId);
        }
    });

    const isRunning = engine.isPolling || engine.state === 'RUNNING';

    const handleToggleRun = () => {
        if (isRunning) {
            setTaskId(null);
        } else {
            generateMutation.mutate();
        }
    };

    const handleReset = () => setTaskId(null);

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-3">
                        <Activity className="text-sky-500 shrink-0" />
                        Intelligence Hub
                    </h2>
                    <p className="text-slate-400 mt-1 text-sm sm:text-base">Real-time optimization metrics and schedule performance.</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors text-sm"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">Reset View</span>
                    </button>
                    <button
                        onClick={handleToggleRun}
                        disabled={generateMutation.isPending}
                        className={cn(
                            "flex items-center gap-2 px-4 sm:px-6 py-2 font-medium rounded-lg shadow-lg active:translate-y-0.5 transition-all text-white text-sm",
                            isRunning
                                ? "bg-amber-600 hover:bg-amber-500 shadow-amber-500/20"
                                : "bg-sky-600 hover:bg-sky-500 shadow-sky-500/20",
                            generateMutation.isPending && "opacity-75 cursor-wait"
                        )}
                    >
                        {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                        {generateMutation.isPending ? 'Starting...' : isRunning ? 'Stop' : 'Run Optimization'}
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {(engine.error || generateMutation.error) && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{engine.error || (generateMutation.error as Error)?.message || "An error occurred."}</p>
                </div>
            )}

            {/* Metrics Grid — stacks to 1 col on mobile, 3 on md+ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <StatCard
                    title="Fitness Score"
                    value={engine.fitness.toFixed(4)}
                    trend={engine.generation > 0 ? "Improving" : undefined}
                    trendUp={true}
                    icon={<Zap className="w-5 h-5" />}
                    description={`Generation ${engine.generation}`}
                />
                <StatCard
                    title="Status"
                    value={engine.state}
                    icon={<Clock className="w-5 h-5" />}
                    description={isRunning ? "Processing..." : "Idle"}
                />
                <StatCard
                    title="Progress"
                    value={`${engine.progress}%`}
                    trend={engine.progress > 0 ? "Active" : undefined}
                    trendUp={true}
                    icon={<Activity className="w-5 h-5" />}
                    description="Optimization cycle"
                    className="border-amber-500/20"
                />
            </div>

            {/* Lower section — stacks on mobile, 2/3 + 1/3 on lg */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Visualization */}
                <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-6 min-h-[300px] sm:min-h-[400px] backdrop-blur-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6 relative z-10">
                        <h3 className="text-base sm:text-lg font-semibold text-slate-200">Genetic Progression</h3>
                    </div>

                    <div className="w-full h-[240px] sm:h-[300px] flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/30 relative z-10 p-4">
                        {isRunning || generateMutation.isPending ? (
                            <div className="text-center space-y-4 w-full max-w-xs">
                                <RefreshCw className="w-10 sm:w-12 h-10 sm:h-12 text-sky-500 animate-spin mx-auto" />
                                <p className="text-slate-400 animate-pulse text-sm sm:text-base">Running Genetic Algorithm...</p>
                                <p className="text-xs text-slate-600 font-mono">
                                    Gen: {engine.generation} | Fitness: {engine.fitness.toFixed(4)}
                                </p>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-sky-500 transition-all duration-500 ease-out"
                                        style={{ width: `${engine.progress}%` }}
                                    />
                                </div>
                            </div>
                        ) : engine.state === 'COMPLETED' ? (
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Zap className="w-6 h-6 text-emerald-500" />
                                </div>
                                <h4 className="text-slate-200 font-medium">Optimization Complete</h4>
                                <p className="text-slate-500 text-sm">Best Fitness: {engine.fitness.toFixed(4)}</p>
                                <button className="text-sky-400 text-sm hover:underline mt-2">View Timetable &rarr;</button>
                            </div>
                        ) : (
                            <div className="text-center text-slate-600 text-sm">
                                <p>Ready to optimize.</p>
                                <p className="text-xs mt-1">Click "Run Optimization" to start.</p>
                            </div>
                        )}
                    </div>

                    <div className="absolute inset-0 bg-grid-slate-800/[0.1] -z-0" />
                </div>

                {/* Logs */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-0 overflow-hidden backdrop-blur-md">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                            <Archive className="w-4 h-4 text-slate-500" />
                            Live Logs
                        </h3>
                    </div>
                    <div className="p-4 space-y-3 font-mono text-xs">
                        {taskId && (
                            <div className="p-2 bg-sky-500/5 border-l-2 border-sky-500 rounded text-sky-200 break-all">
                                <span className="text-sky-500 font-bold">INFO</span> Task: {taskId.slice(0, 16)}…
                            </div>
                        )}
                        {engine.state === 'RUNNING' && (
                            <div className="p-2 bg-sky-500/5 border-l-2 border-sky-500 rounded text-slate-300">
                                <span className="text-sky-500 font-bold">RUN</span> Generation {engine.generation}…
                            </div>
                        )}
                        {engine.state === 'COMPLETED' && (
                            <div className="p-2 bg-emerald-500/5 border-l-2 border-emerald-500 rounded text-emerald-200">
                                <span className="text-emerald-500 font-bold">DONE</span> Solved in {engine.generation} gens.
                            </div>
                        )}
                        {!taskId && <div className="text-slate-600 italic">Waiting...</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}
