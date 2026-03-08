import { useState } from 'react';
import { BookOpen, User, MapPin, Plus, Search, Loader2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resourcesApi } from '../lib/api';
import { useAuth } from '../store/AuthContext';
import { ResourceModal } from '../components/ResourceModal';

type Tab = 'courses' | 'faculty' | 'rooms';

export function Resources() {
    const { workspace } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<Tab>('courses');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const { data: courses, isLoading: loadingCourses } = useQuery({
        queryKey: ['courses', workspace?.id, searchTerm],
        queryFn: () => resourcesApi.courses.list(workspace?.id, searchTerm),
        enabled: activeTab === 'courses' && !!workspace
    });

    const { data: lecturers, isLoading: loadingLecturers } = useQuery({
        queryKey: ['faculty', workspace?.id],
        queryFn: () => resourcesApi.lecturers.list(workspace?.id),
        enabled: activeTab === 'faculty' && !!workspace
    });

    const { data: rooms, isLoading: loadingRooms } = useQuery({
        queryKey: ['rooms', workspace?.id],
        queryFn: () => resourcesApi.rooms.list(workspace?.id),
        enabled: activeTab === 'rooms' && !!workspace
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            if (activeTab === 'courses') return resourcesApi.courses.delete(id);
            if (activeTab === 'faculty') return resourcesApi.lecturers.delete(id);
            if (activeTab === 'rooms') return resourcesApi.rooms.delete(id);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [activeTab] })
    });

    // Unwrap axios response (.data) then DRF pagination (.results) if present
    const unwrap = (res: any): any[] => {
        if (!res) return [];
        // Axios wraps the response body in res.data
        const inner = res?.data !== undefined ? res.data : res;
        // DRF PageNumberPagination wraps results in { count, results: [...] }
        if (Array.isArray(inner)) return inner;
        if (inner?.results && Array.isArray(inner.results)) return inner.results;
        return [];
    };

    const getData = () => {
        if (activeTab === 'courses') return unwrap(courses);
        if (activeTab === 'faculty') return unwrap(lecturers);
        if (activeTab === 'rooms') return unwrap(rooms);
        return [] as any[];
    };


    const isLoading = loadingCourses || loadingLecturers || loadingRooms;
    const data = getData();

    const tabs = [
        { id: 'courses', label: 'Courses', icon: BookOpen },
        { id: 'faculty', label: 'Faculty', icon: User },
        { id: 'rooms', label: 'Rooms', icon: MapPin },
    ];

    const addLabel = activeTab === 'courses' ? 'Course' : activeTab === 'faculty' ? 'Lecturer' : 'Room';

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">Resource Registry</h2>
                    <p className="text-slate-400 mt-1 text-sm">Manage academic assets and scheduling constraints.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg shadow-lg shadow-sky-500/20 transition-all active:translate-y-0.5 text-sm w-full sm:w-auto justify-center sm:justify-start"
                >
                    <Plus className="w-4 h-4" />
                    Add {addLabel}
                </button>
            </div>

            {/* Tabs — scrollable horizontally on mobile */}
            <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id as Tab); setSearchTerm(""); }}
                            className={cn(
                                "flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 transition-all font-medium text-sm whitespace-nowrap shrink-0",
                                isActive
                                    ? "border-sky-500 text-sky-400 bg-sky-500/5"
                                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* List Panel */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm min-h-[40vh] w-full">
                {/* Search bar */}
                <div className="p-3 sm:p-4 border-b border-slate-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder={`Search ${activeTab}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 transition-colors"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500 px-4 text-center">
                        <p className="text-sm">No resources found.</p>
                        <button onClick={() => setIsModalOpen(true)} className="text-sky-500 hover:underline mt-2 text-sm">
                            Create one now
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800/50">
                        {data.map((item: any) => (
                            <div
                                key={item.id}
                                className="p-3 sm:p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors group"
                            >
                                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                    <div className={cn(
                                        "w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0",
                                        activeTab === 'courses' ? "bg-sky-500/10 text-sky-400" :
                                            activeTab === 'faculty' ? "bg-emerald-500/10 text-emerald-400" :
                                                "bg-rose-500/10 text-rose-400"
                                    )}>
                                        {activeTab === 'courses' && <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />}
                                        {activeTab === 'faculty' && <User className="w-4 h-4 sm:w-5 sm:h-5" />}
                                        {activeTab === 'rooms' && <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-slate-200 font-medium text-sm truncate">
                                            {activeTab === 'courses' ? `${item.code} - ${item.name}` : item.name}
                                        </h4>
                                        <p className="text-slate-500 text-xs mt-0.5 truncate">
                                            {activeTab === 'courses' ? `${item.duration_hours} Credit Hours` :
                                                activeTab === 'faculty' ? item.department :
                                                    `Capacity: ${item.capacity} · ${item.building}`}
                                        </p>
                                    </div>
                                </div>
                                {/* Delete — visible on hover on desktop, always on mobile */}
                                <button
                                    onClick={() => deleteMutation.mutate(item.id)}
                                    className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && <ResourceModal type={activeTab} onClose={() => setIsModalOpen(false)} />}
        </div>
    );
}
