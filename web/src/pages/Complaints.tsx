import { useState, useEffect } from 'react';
import {
    MessageSquareWarning, Plus, Loader2, AlertCircle, CheckCircle2,
    Clock, X, Send,
} from 'lucide-react';
import { complaintsApi, type ComplaintResponse } from '../lib/api';
import { useAuth } from '../store/AuthContext';

export function Complaints() {
    const { user } = useAuth();
    const [complaints, setComplaints] = useState<ComplaintResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // New complaint form
    const [showForm, setShowForm] = useState(false);
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const isAdmin = user?.role === 'ADMIN';

    useEffect(() => {
        loadComplaints();
    }, []);

    const loadComplaints = async () => {
        setLoading(true);
        try {
            const { data } = await complaintsApi.list();
            setComplaints(data);
        } catch (err: any) {
            setError('Failed to load complaints.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !description.trim()) return;

        setSubmitting(true);
        setError(null);
        try {
            // Lecturer submits — the backend knows who they are via auth
            await complaintsApi.create({
                lecturer: 0, // Will be overridden by backend for auth'd user
                subject: subject.trim(),
                description: description.trim(),
            });
            setSuccess(true);
            setSubject('');
            setDescription('');
            setShowForm(false);
            await loadComplaints();
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to submit complaint.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResolve = async (id: number) => {
        try {
            await complaintsApi.update(id, { status: 'RESOLVED' });
            await loadComplaints();
        } catch {
            setError('Failed to update complaint.');
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
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                        <MessageSquareWarning className="w-7 h-7 text-amber-400" />
                        {isAdmin ? 'All Complaints' : 'My Complaints'}
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {isAdmin
                            ? 'View and manage complaints from all staff members'
                            : 'Submit feedback or report scheduling issues'}
                    </p>
                </div>
                {!isAdmin && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-amber-900/20"
                    >
                        {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showForm ? 'Cancel' : 'New Complaint'}
                    </button>
                )}
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
                    Complaint submitted successfully!
                </div>
            )}

            {/* ── New Complaint Form ──────────────── */}
            {showForm && (
                <form
                    onSubmit={handleSubmit}
                    className="bg-slate-900/50 border border-amber-500/20 rounded-2xl p-6 space-y-4"
                >
                    <h3 className="text-slate-200 font-medium flex items-center gap-2">
                        <Send className="w-4 h-4 text-amber-400" />
                        Submit New Complaint
                    </h3>

                    <div>
                        <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">
                            Subject
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="e.g. Room conflict on Monday"
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/25 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the issue in detail..."
                            rows={4}
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/25 transition-all resize-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || !subject.trim() || !description.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-amber-900/20"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Submit Complaint
                    </button>
                </form>
            )}

            {/* ── Complaints List ────────────────── */}
            {complaints.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                    <MessageSquareWarning className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-medium">No complaints yet</p>
                    <p className="text-sm mt-1">
                        {isAdmin
                            ? 'No complaints have been submitted by staff.'
                            : 'Tap "New Complaint" to submit one.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {complaints.map((c) => (
                        <div
                            key={c.id}
                            className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:bg-slate-800/30 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider ${c.status === 'OPEN'
                                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                            }`}>
                                            {c.status}
                                        </span>
                                        {isAdmin && c.lecturer_name && (
                                            <span className="text-xs text-slate-500">
                                                by {c.lecturer_name}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-slate-200 font-medium text-sm">{c.subject}</h3>
                                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">{c.description}</p>
                                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-600">
                                        <Clock className="w-3 h-3" />
                                        {new Date(c.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'short', day: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </div>
                                </div>

                                {isAdmin && c.status === 'OPEN' && (
                                    <button
                                        onClick={() => handleResolve(c.id)}
                                        className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5 shrink-0"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Resolve
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
