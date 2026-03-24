import { ClipboardList, Loader2, User, Clock } from 'lucide-react';
import { auditLogApi, type AuditLogEntry } from '../lib/api';
import { useAuth } from '../store/AuthContext';
import { useQuery } from '@tanstack/react-query';

export function AuditLog() {
    const { workspace } = useAuth();

    const { data: logs, isLoading } = useQuery({
        queryKey: ['audit-log', workspace?.id],
        queryFn: () => auditLogApi.list(workspace?.id),
        select: (res) => res.data as AuditLogEntry[],
        refetchInterval: 30_000, // auto-refresh every 30s
    });

    const formatTime = (ts: string) =>
        new Date(ts).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                    <ClipboardList className="w-6 h-6 text-sky-400 shrink-0" />
                    Audit Log
                </h2>
                <p className="text-slate-400 mt-1 text-sm">Recent system activity and change history.</p>
            </div>

            {/* Log List */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
                    <h3 className="text-slate-200 font-medium text-sm">Activity Feed</h3>
                    <span className="text-slate-500 text-xs">Auto-refreshes every 30s</span>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
                    </div>
                ) : !logs || logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                        <ClipboardList className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm">No activity recorded yet.</p>
                        <p className="text-xs mt-1 text-slate-600">Actions like adding resources or generating timetables will appear here.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800/50">
                        {logs.map((entry) => (
                            <div key={entry.id} className="p-4 flex items-start gap-4 hover:bg-slate-800/20 transition-colors">
                                {/* Actor avatar */}
                                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                                    <User className="w-4 h-4 text-slate-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-slate-200 text-sm">
                                        <span className="font-semibold text-sky-400">{entry.actor_name}</span>
                                        {' '}<span className="text-slate-400">{entry.action}</span>
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600">
                                        <Clock className="w-3 h-3" />
                                        {formatTime(entry.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
