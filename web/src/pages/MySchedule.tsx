import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { lecturerApi, type ScheduleEntry } from '../lib/api';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIMESLOT_LABELS = [
    '08:00 – 09:00', '09:00 – 10:00', '10:00 – 11:00', '11:00 – 12:00',
    '12:00 – 13:00', '13:00 – 14:00', '14:00 – 15:00', '15:00 – 16:00',
    '16:00 – 17:00',
];
const SLOTS_PER_DAY = TIMESLOT_LABELS.length;

export function MySchedule() {
    const [entries, setEntries] = useState<ScheduleEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadSchedule();
    }, []);

    const loadSchedule = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await lecturerApi.schedule();
            setEntries(data.entries || []);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load schedule.');
        } finally {
            setLoading(false);
        }
    };

    // Build grid: day → timeslot → entry
    const grid: Record<number, Record<number, ScheduleEntry>> = {};
    entries.forEach((entry) => {
        const day = Math.floor(entry.timeslot_index / SLOTS_PER_DAY);
        const slot = entry.timeslot_index % SLOTS_PER_DAY;
        if (!grid[day]) grid[day] = {};
        grid[day][slot] = entry;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-fluid-xl sm:text-fluid-2xl font-bold text-slate-100 flex items-center gap-3">
                        <Calendar className="text-sky-400 shrink-0 w-6 h-6 sm:w-7 sm:h-7" />
                        My Schedule
                    </h1>
                    <p className="text-slate-400 text-fluid-sm mt-1">
                        Your assigned classes for the current timetable
                    </p>
                </div>
                <div className="text-sm text-slate-500">
                    {entries.length} class{entries.length !== 1 ? 'es' : ''} assigned
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
            )}

            {entries.length === 0 && !error ? (
                <div className="text-center py-20 text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-medium">No schedule available</p>
                    <p className="text-sm mt-1">No active timetable or classes assigned yet.</p>
                </div>
            ) : (
                /* ── Timetable Grid ─────────────────── */
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden w-full">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full border-collapse min-w-max">
                            <thead>
                                <tr className="bg-slate-800/60">
                                    <th className="p-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-28">
                                        <Clock className="w-4 h-4 inline mr-1" /> Time
                                    </th>
                                    {DAY_NAMES.map((day) => (
                                        <th key={day} className="p-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                                            {day}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {TIMESLOT_LABELS.map((timeLabel, slotIdx) => (
                                    <tr key={slotIdx} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                                        <td className="p-3 text-xs font-mono text-slate-500 whitespace-nowrap border-r border-slate-800/40">
                                            {timeLabel}
                                        </td>
                                        {DAY_NAMES.map((_, dayIdx) => {
                                            const entry = grid[dayIdx]?.[slotIdx];
                                            return (
                                                <td key={dayIdx} className="p-2 border-r border-slate-800/40 last:border-r-0">
                                                    {entry ? (
                                                        <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-2.5 hover:bg-sky-500/15 transition-colors">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                                                                <span className="text-sky-300 text-fluid-xs font-semibold truncate">
                                                                    {entry.course_code}
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-300 text-fluid-xs truncate">{entry.course_name}</p>
                                                            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-fluid-xs text-slate-500">
                                                                <span className="flex items-center gap-0.5 truncate">
                                                                    <MapPin className="w-3 h-3 shrink-0" /> {entry.room_name}
                                                                </span>
                                                                <span className="flex items-center gap-0.5 truncate">
                                                                    <Users className="w-3 h-3 shrink-0" /> {entry.group_name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
