import { useState, useEffect } from 'react';
import { SlidersHorizontal, Save, Loader2, AlertCircle, CheckCircle2, Clock, Sun, Moon } from 'lucide-react';
import { lecturerApi } from '../lib/api';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function Preferences() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Preference state
    const [maxHoursPerWeek, setMaxHoursPerWeek] = useState(20);
    const [maxDailyHours, setMaxDailyHours] = useState(6);
    const [preferredDays, setPreferredDays] = useState<number[]>([0, 1, 2, 3, 4]);
    const [avoidDays, setAvoidDays] = useState<number[]>([]);
    const [morningOnly, setMorningOnly] = useState(false);

    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        setLoading(true);
        try {
            const { data } = await lecturerApi.getPreferences();
            const prefs = data.preferences || {};
            setMaxHoursPerWeek(prefs.max_hours_per_week ?? 20);
            setMaxDailyHours(prefs.max_daily_hours ?? 6);
            setPreferredDays(prefs.preferred_days ?? [0, 1, 2, 3, 4]);
            setAvoidDays(prefs.avoid_days ?? []);
            setMorningOnly(prefs.morning_only ?? false);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load preferences.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            await lecturerApi.updatePreferences({
                max_hours_per_week: maxHoursPerWeek,
                max_daily_hours: maxDailyHours,
                preferred_days: preferredDays,
                avoid_days: avoidDays,
                morning_only: morningOnly,
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to save preferences.');
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (dayIdx: number, list: number[], setter: (v: number[]) => void) => {
        if (list.includes(dayIdx)) {
            setter(list.filter(d => d !== dayIdx));
        } else {
            setter([...list, dayIdx]);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                    <SlidersHorizontal className="w-7 h-7 text-sky-400" />
                    Scheduling Preferences
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                    Set your availability and scheduling preferences. These are used as soft constraints by the optimization engine.
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
            )}

            {success && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    Preferences saved successfully!
                </div>
            )}

            {/* Form Card */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-8">

                {/* ── Hours Limits ──────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-3">
                            <Clock className="w-4 h-4 text-sky-400" />
                            Max Hours Per Week
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={40}
                            value={maxHoursPerWeek}
                            onChange={(e) => setMaxHoursPerWeek(Number(e.target.value))}
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/25 transition-all"
                        />
                        <p className="text-slate-600 text-xs mt-1">Total teaching hours per week</p>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-3">
                            <Clock className="w-4 h-4 text-sky-400" />
                            Max Hours Per Day
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={maxDailyHours}
                            onChange={(e) => setMaxDailyHours(Number(e.target.value))}
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/25 transition-all"
                        />
                        <p className="text-slate-600 text-xs mt-1">Maximum classes in a single day</p>
                    </div>
                </div>

                {/* ── Preferred Days ────────────────── */}
                <div>
                    <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-3">
                        <Sun className="w-4 h-4 text-amber-400" />
                        Preferred Days
                    </label>
                    <p className="text-slate-500 text-xs mb-3">Days you prefer to teach on</p>
                    <div className="flex flex-wrap gap-2">
                        {DAY_NAMES.map((day, idx) => (
                            <button
                                key={day}
                                onClick={() => toggleDay(idx, preferredDays, setPreferredDays)}
                                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${preferredDays.includes(idx)
                                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                                        : 'bg-slate-800/50 border border-slate-700 text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Avoid Days ────────────────────── */}
                <div>
                    <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-3">
                        <Moon className="w-4 h-4 text-rose-400" />
                        Days to Avoid
                    </label>
                    <p className="text-slate-500 text-xs mb-3">Days you'd rather not teach</p>
                    <div className="flex flex-wrap gap-2">
                        {DAY_NAMES.map((day, idx) => (
                            <button
                                key={day}
                                onClick={() => toggleDay(idx, avoidDays, setAvoidDays)}
                                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${avoidDays.includes(idx)
                                        ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                                        : 'bg-slate-800/50 border border-slate-700 text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Morning Only ──────────────────── */}
                <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <div
                            onClick={() => setMorningOnly(!morningOnly)}
                            className={`w-12 h-7 rounded-full transition-all relative ${morningOnly
                                    ? 'bg-sky-500'
                                    : 'bg-slate-700'
                                }`}
                        >
                            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-lg transition-all ${morningOnly ? 'left-5.5' : 'left-0.5'
                                }`} />
                        </div>
                        <div>
                            <span className="text-slate-300 text-sm font-medium">Morning Classes Only</span>
                            <p className="text-slate-500 text-xs">Prefer to teach before 12:00 PM only</p>
                        </div>
                    </label>
                </div>

                {/* ── Save Button ───────────────────── */}
                <div className="pt-4 border-t border-slate-800">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-sky-900/30"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Preferences
                    </button>
                </div>
            </div>
        </div>
    );
}
