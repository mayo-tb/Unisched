import { useState } from "react";
import {
    Filter,
    Calendar as CalIcon,
    Download,
    RotateCw,
    Play,
    Loader2,
} from "lucide-react";
import { TimetableGrid } from "../components/TimetableGrid";
import { useWorkspaces, useTimetableEntries, useRooms, useGenerateGA, usePatchEntry } from "../hooks/useApi";
import { useEngineProgress } from "../hooks/useEngineProgress";
import { cn } from "../lib/utils";
import type { TimetableEntryResponse, RoomResponse } from "../lib/api";

/* ── Mock fallback data (used when API is unavailable) ───── */

const MOCK_ENTRIES: TimetableEntryResponse[] = [
    { id: 1, version: 1, course: 1, room: 1, timeslot_index: 0, course_name: "Intro to Genetic Algorithms", course_code: "CS101", room_name: "Room 101", lecturer_name: "Dr. Smith", group_name: "CS Year 1", group_size: 45 },
    { id: 2, version: 1, course: 2, room: 2, timeslot_index: 10, course_name: "Calculus II", course_code: "MATH202", room_name: "Room 203", lecturer_name: "Prof. Euler", group_name: "Math Year 2", group_size: 35 },
    { id: 3, version: 1, course: 3, room: 3, timeslot_index: 2, course_name: "Quantum Physics", course_code: "PHY101", room_name: "Lab A", lecturer_name: "Dr. Bohr", group_name: "Phys Year 1", group_size: 30 },
    { id: 4, version: 1, course: 4, room: 4, timeslot_index: 19, course_name: "Data Structures", course_code: "CS201", room_name: "Room 305", lecturer_name: "Prof. Ada", group_name: "CS Year 2", group_size: 40 },
    { id: 5, version: 1, course: 5, room: 5, timeslot_index: 28, course_name: "Organic Chemistry", course_code: "CHEM301", room_name: "Lab B", lecturer_name: "Dr. Mendeleev", group_name: "Chem Year 3", group_size: 25 },
    { id: 6, version: 1, course: 1, room: 2, timeslot_index: 14, course_name: "Machine Learning", course_code: "CS401", room_name: "Room 203", lecturer_name: "Dr. Turing", group_name: "CS Year 4", group_size: 35 },
    { id: 7, version: 1, course: 2, room: 3, timeslot_index: 37, course_name: "Linear Algebra", course_code: "MATH101", room_name: "Room 102", lecturer_name: "Prof. Gauss", group_name: "Math Year 1", group_size: 50 },
    { id: 8, version: 1, course: 3, room: 1, timeslot_index: 5, course_name: "Digital Logic", course_code: "EE201", room_name: "Lab C", lecturer_name: "Dr. Shannon", group_name: "EE Year 2", group_size: 38 },
    { id: 9, version: 1, course: 4, room: 2, timeslot_index: 22, course_name: "Operating Systems", course_code: "CS301", room_name: "Room 401", lecturer_name: "Prof. Linus", group_name: "CS Year 3", group_size: 42 },
    { id: 10, version: 1, course: 5, room: 4, timeslot_index: 40, course_name: "Thermodynamics", course_code: "PHY201", room_name: "Room 204", lecturer_name: "Dr. Carnot", group_name: "Phys Year 2", group_size: 28 },
];

const MOCK_ROOMS: RoomResponse[] = [
    { id: 1, name: "Room 101", capacity: 60, building: "Block A", workspace: "" },
    { id: 2, name: "Room 203", capacity: 45, building: "Block B", workspace: "" },
    { id: 3, name: "Lab A", capacity: 30, building: "Science Wing", workspace: "" },
    { id: 4, name: "Room 305", capacity: 50, building: "Block C", workspace: "" },
    { id: 5, name: "Lab B", capacity: 25, building: "Science Wing", workspace: "" },
];

/* ── Component ─────────────────────────────────── */

export function Timetable() {
    const [taskId, setTaskId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"all" | "lecturers" | "rooms">("all");

    /* — API Hooks — */
    const { data: workspaces } = useWorkspaces();
    const activeWs = workspaces?.[0];

    const { data: apiEntries } = useTimetableEntries(activeWs ? 1 : undefined);
    const { data: apiRooms } = useRooms(activeWs?.id);

    const generateMutation = useGenerateGA();
    const patchMutation = usePatchEntry(1);

    const engineProgress = useEngineProgress(taskId);

    /* Use API data if available, otherwise mock */
    const entries = apiEntries ?? MOCK_ENTRIES;
    const rooms = apiRooms ?? MOCK_ROOMS;

    /* — Handlers — */
    const handleGenerate = async () => {
        if (!activeWs) return;
        try {
            const { task_id } = await generateMutation.mutateAsync({
                wsId: activeWs.id,
                populationSize: 50,
                generations: 100,
            });
            setTaskId(task_id);
        } catch {
            /* Silently handle when backend is offline */
        }
    };

    const handleRoomReassign = async (entryIdx: number, newRoomId: number) => {
        await patchMutation.mutateAsync({
            entryIdx,
            payload: { room_id: newRoomId },
        });
    };

    const tabs = [
        { id: "all" as const, label: "All" },
        { id: "lecturers" as const, label: "Lecturers" },
        { id: "rooms" as const, label: "Rooms" },
    ];

    return (
        <div className="space-y-6 gc-page">
            {/* ── Header / Controls ────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-3">
                        <CalIcon className="text-primary shrink-0" />
                        <span className="truncate">Master Schedule</span>
                    </h2>
                    <p className="text-slate-400 mt-1 text-sm">
                        View and manage class allocations across the campus.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* View tabs */}
                    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-1 flex shrink-0">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all",
                                    activeTab === tab.id
                                        ? "bg-slate-800 text-white shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <button className="gc-btn-ghost text-xs sm:text-sm">
                        <Filter className="w-4 h-4" />
                        <span className="hidden sm:inline">Filters</span>
                    </button>

                    {/* Generate button */}
                    <button
                        onClick={handleGenerate}
                        disabled={engineProgress.isPolling || generateMutation.isPending}
                        className={cn(
                            "gc-btn-primary text-xs sm:text-sm",
                            engineProgress.isPolling && "opacity-80"
                        )}
                    >
                        {engineProgress.isPolling ? (
                            <>
                                <RotateCw className="w-4 h-4 animate-spin" />
                                <span className="hidden sm:inline">Evolving…</span> {engineProgress.progress}%
                            </>
                        ) : generateMutation.isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Starting…
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4 fill-current" />
                                <span className="hidden sm:inline">Run Optimization</span>
                            </>
                        )}
                    </button>

                    <button className="gc-btn-ghost text-xs sm:text-sm">
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                </div>
            </div>


            {/* ── Engine Progress Bar ──────────────── */}
            {engineProgress.isPolling && (
                <div className="gc-card p-4 flex items-center gap-4 animate-fade-in">
                    <RotateCw className="w-5 h-5 text-primary animate-spin shrink-0" />
                    <div className="flex-1">
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-slate-300 font-medium">
                                Generation {engineProgress.generation}
                            </span>
                            <span className="text-slate-500 font-mono text-xs">
                                Fitness: {engineProgress.fitness.toFixed(4)}
                            </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-sky-400 rounded-full transition-all duration-500"
                                style={{ width: `${engineProgress.progress}%` }}
                            />
                        </div>
                    </div>
                    <span className="text-primary font-bold text-lg tabular-nums">
                        {engineProgress.progress}%
                    </span>
                </div>
            )}

            {/* ── Timetable Grid ───────────────────── */}
            <TimetableGrid
                entries={entries}
                rooms={rooms}
                versionId={1}
                onRoomReassign={handleRoomReassign}
            />
        </div>
    );
}
