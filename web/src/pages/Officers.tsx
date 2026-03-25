import { useState } from 'react';
import { Users, Plus, Loader2, AlertCircle, CheckCircle2, Copy, X, Mail, User, Building2, Pencil, Power, PowerOff } from 'lucide-react';
import { officersApi, type OfficerResponse, type RegisterOfficerResult } from '../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function Officers() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [department, setDepartment] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<RegisterOfficerResult | null>(null);
    const [copied, setCopied] = useState(false);

    // Edit state
    const [editingOfficer, setEditingOfficer] = useState<OfficerResponse | null>(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editError, setEditError] = useState<string | null>(null);

    const { data: officersList, isLoading } = useQuery({
        queryKey: ['officers'],
        queryFn: () => officersApi.list(),
        select: (res) => res.data as OfficerResponse[],
    });

    const registerMutation = useMutation({
        mutationFn: (data: { full_name: string; email: string; department?: string }) =>
            officersApi.register(data),
        onSuccess: (res) => {
            setResult(res.data);
            setFullName(''); setEmail(''); setDepartment('');
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['officers'] });
        },
        onError: (err: any) => {
            setError(err.response?.data?.email?.[0] || err.response?.data?.detail || 'Registration failed.');
        },
    });

    const toggleMutation = useMutation({
        mutationFn: (id: number) => officersApi.toggleActive(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['officers'] }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { full_name?: string; email?: string } }) =>
            officersApi.update(id, data),
        onSuccess: () => {
            setEditingOfficer(null);
            queryClient.invalidateQueries({ queryKey: ['officers'] });
        },
        onError: (err: any) => {
            setEditError(err.response?.data?.error || 'Update failed.');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || !email.trim()) return;
        setError(null);
        registerMutation.mutate({ full_name: fullName.trim(), email: email.trim(), department: department.trim() });
    };

    const handleEditSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingOfficer) return;
        setEditError(null);
        updateMutation.mutate({ id: editingOfficer.id, data: { full_name: editName.trim(), email: editEmail.trim() } });
    };

    const openEdit = (officer: OfficerResponse) => {
        setEditingOfficer(officer);
        setEditName(officer.full_name);
        setEditEmail(officer.email);
        setEditError(null);
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const inputClass =
        "w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/25 transition-all";

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                        <Users className="w-6 h-6 text-sky-400 shrink-0" />
                        Timetable Officers
                    </h2>
                    <p className="text-slate-400 mt-1 text-sm">Register and manage timetable officer accounts.</p>
                </div>
                <button
                    onClick={() => { setShowForm(!showForm); setResult(null); setError(null); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-sky-900/20 text-sm"
                >
                    {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showForm ? 'Cancel' : 'Register Officer'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                </div>
            )}

            {/* Generated Credentials */}
            {result && (
                <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-5 h-5" />
                        Officer registered! Credentials sent by email (if SMTP is configured).
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-4 font-mono text-sm space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Email / Username:</span>
                            <span className="text-slate-200">{result.email}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Generated Password:</span>
                            <div className="flex items-center gap-2">
                                <span className="text-amber-300 font-bold">{result.generated_password}</span>
                                <button onClick={() => handleCopy(result.generated_password)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors">
                                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">⚠️ Save this password — it won't be shown again.</p>
                </div>
            )}

            {/* Registration Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <h3 className="text-slate-200 font-semibold mb-2">New Timetable Officer</h3>
                    <div>
                        <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                                placeholder="e.g. Dr. Jane Smith" className={`${inputClass} pl-10`} required />
                        </div>
                    </div>
                    <div>
                        <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="e.g. jane.smith@university.edu" className={`${inputClass} pl-10`} required />
                        </div>
                    </div>
                    <div>
                        <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">Department <span className="text-slate-600">(optional)</span></label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                                placeholder="e.g. Computer Science" className={`${inputClass} pl-10`} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">A secure password will be auto-generated and sent to the officer's email.</p>
                    <button type="submit" disabled={registerMutation.isPending || !fullName.trim() || !email.trim()}
                        className="flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium transition-all disabled:opacity-50">
                        {registerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {registerMutation.isPending ? 'Registering...' : 'Register Officer'}
                    </button>
                </form>
            )}

            {/* Edit Modal */}
            {editingOfficer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <form onSubmit={handleEditSave} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-slate-200 font-semibold text-lg">Edit Officer</h3>
                            <button type="button" onClick={() => setEditingOfficer(null)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {editError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4" /> {editError}
                            </div>
                        )}
                        <div>
                            <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                    className={`${inputClass} pl-10`} required />
                            </div>
                        </div>
                        <div>
                            <label className="block text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                                    className={`${inputClass} pl-10`} required />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setEditingOfficer(null)}
                                className="flex-1 py-3 border border-slate-700 text-slate-400 rounded-xl font-medium hover:bg-slate-800 transition-all">
                                Cancel
                            </button>
                            <button type="submit" disabled={updateMutation.isPending}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium transition-all disabled:opacity-50">
                                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Officers List */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 bg-slate-900/40">
                    <h3 className="text-slate-200 font-medium text-sm">Registered Officers</h3>
                </div>
                {isLoading ? (
                    <div className="flex items-center justify-center h-40"><Loader2 className="w-7 h-7 text-sky-400 animate-spin" /></div>
                ) : !officersList || officersList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                        <Users className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm">No officers registered yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800/50">
                        {officersList.map((officer) => (
                            <div key={officer.id} className="p-4 flex items-center gap-4 hover:bg-slate-800/20 transition-colors">
                                {/* Avatar */}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${officer.is_active ? 'bg-gradient-to-tr from-sky-500 to-indigo-400' : 'bg-slate-700'}`}>
                                    <span className="text-white font-bold text-xs">
                                        {officer.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                    </span>
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-slate-200 font-medium text-sm">{officer.full_name}</p>
                                    <p className="text-slate-500 text-xs">{officer.email}</p>
                                </div>
                                {/* Status Badge */}
                                <div className="text-center hidden sm:block">
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${officer.is_active ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-slate-700/50 text-slate-500 border-slate-700'}`}>
                                        {officer.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                    <p className="text-slate-600 text-xs mt-1">
                                        {new Date(officer.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                                {/* Actions */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => openEdit(officer)}
                                        className="p-2 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                                        title="Edit officer">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => toggleMutation.mutate(officer.id)}
                                        disabled={toggleMutation.isPending}
                                        className={`p-2 rounded-lg transition-colors ${officer.is_active ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                                        title={officer.is_active ? 'Deactivate account' : 'Activate account'}>
                                        {officer.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
