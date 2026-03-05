import { useState } from 'react';
import { X, Loader2, Save, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resourcesApi } from '../lib/api';
import { useAuth } from '../store/AuthContext';

type ResourceType = 'courses' | 'faculty' | 'rooms' | 'groups';

interface ResourceModalProps {
    type: ResourceType;
    onClose: () => void;
}

export function ResourceModal({ type, onClose }: ResourceModalProps) {
    const { workspace } = useAuth();
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<Record<string, any>>({});
    // FIX: Removed redundant `submitting` state — use mutation.isPending directly
    // FIX: Added local error state to display API validation errors in the modal
    const [apiError, setApiError] = useState<string | null>(null);

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            // FIX: Guard — if no workspace is linked, throw before API call
            if (!workspace?.id) throw new Error("No workspace selected. Please log in again.");
            const payload = { ...data, workspace: workspace.id };
            switch (type) {
                case 'courses': return resourcesApi.courses.create(payload);
                case 'faculty': return resourcesApi.lecturers.create(payload);
                case 'rooms': return resourcesApi.rooms.create(payload);
                case 'groups': return resourcesApi.groups.create(payload);
                default: throw new Error(`Unknown resource type: ${type}`);
            }
        },
        onSuccess: () => {
            // Invalidate the correct query key for the active tab
            queryClient.invalidateQueries({ queryKey: [type] });
            onClose();
        },
        // FIX: onError was missing entirely — mutation failures were silently swallowed
        onError: (err: any) => {
            // Extract DRF validation errors (e.g., { name: ["This field is required."] })
            const detail =
                err?.response?.data?.detail ||
                Object.values(err?.response?.data || {}).flat().join(" ") ||
                err?.message ||
                "An error occurred. Please try again.";
            setApiError(String(detail));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setApiError(null);
        // FIX: Changed from `await mutation.mutateAsync` to `mutation.mutate`
        // mutateAsync throws unhandled rejection if there's no surrounding try/catch.
        // Using `mutation.mutate` + onError callback is the correct React Query pattern.
        mutation.mutate(formData);
    };

    const handleChange = (field: string, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const labels: Record<ResourceType, string> = {
        courses: 'New Course',
        faculty: 'New Lecturer',
        rooms: 'New Room',
        groups: 'New Student Group',
    };

    return (
        <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            // FIX: Allow closing modal by clicking backdrop
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
                    aria-label="Close modal"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-slate-100">{labels[type]}</h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* API Error Banner */}
                    {apiError && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{apiError}</span>
                        </div>
                    )}

                    {/* ── COURSE FIELDS ── */}
                    {type === 'courses' && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Course Code *</label>
                                <input required type="text" placeholder="e.g. CS101"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500/50"
                                    onChange={e => handleChange('code', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Course Name *</label>
                                <input required type="text" placeholder="e.g. Intro to Programming"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500/50"
                                    onChange={e => handleChange('name', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Duration (Hours) *</label>
                                <input required type="number" min="1" max="4" defaultValue="1"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500/50"
                                    onChange={e => handleChange('duration_hours', parseInt(e.target.value))} />
                            </div>
                        </>
                    )}

                    {/* ── FACULTY FIELDS ── */}
                    {type === 'faculty' && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
                                <input required type="text" placeholder="e.g. Dr. Jane Doe"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500/50"
                                    onChange={e => handleChange('name', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Department *</label>
                                <input required type="text" placeholder="e.g. Computer Science"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500/50"
                                    onChange={e => handleChange('department', e.target.value)} />
                            </div>
                        </>
                    )}

                    {/* ── ROOM FIELDS ── */}
                    {type === 'rooms' && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Room Name *</label>
                                <input required type="text" placeholder="e.g. Lecture Hall A"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500/50"
                                    onChange={e => handleChange('name', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Capacity *</label>
                                    <input required type="number" min="10" placeholder="50"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500/50"
                                        onChange={e => handleChange('capacity', parseInt(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Building</label>
                                    <input type="text" placeholder="Main Block"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500/50"
                                        onChange={e => handleChange('building', e.target.value)} />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="flex items-center justify-between pt-4">
                        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-200 text-sm">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex items-center gap-2 px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {mutation.isPending ? 'Saving...' : 'Create Resource'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
