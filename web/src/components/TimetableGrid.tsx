import { useState } from "react";
import { Clock, MapPin, User, Users } from "lucide-react";
import { CourseCardTooltip } from "./CourseCardTooltip";
import { RoomReassignModal } from "./RoomReassignModal";
import { cn } from "../lib/utils";
import type { TimetableEntryResponse, RoomResponse } from "../lib/api";

/* ── TypeScript Interfaces ─────────────────────── */

interface TimetableGridProps {
    /** Schedule entries to render */
    entries: TimetableEntryResponse[];
    /** Available rooms for reassignment modal */
    rooms: RoomResponse[];
    /** Timetable version ID for PATCH */
    versionId: number;
    /** Called when user reassigns a room */
    onRoomReassign: (entryIdx: number, newRoomId: number) => Promise<void>;
}

/* ── Constants ─────────────────────────────────── */

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI"];
const HOURS = Array.from({ length: 9 }, (_, i) => 8 + i); // 8:00–16:00

/** Color palette for course cards - rotates through 5 colors */
const CARD_COLORS = [
    { bg: "bg-sky-500/10", border: "border-sky-500/20", hoverBorder: "hover:border-sky-500/40", badge: "bg-sky-500", text: "text-sky-400" },
    { bg: "bg-emerald-500/10", border: "border-emerald-500/20", hoverBorder: "hover:border-emerald-500/40", badge: "bg-emerald-500", text: "text-emerald-400" },
    { bg: "bg-rose-500/10", border: "border-rose-500/20", hoverBorder: "hover:border-rose-500/40", badge: "bg-rose-500", text: "text-rose-400" },
    { bg: "bg-amber-500/10", border: "border-amber-500/20", hoverBorder: "hover:border-amber-500/40", badge: "bg-amber-500", text: "text-amber-400" },
    { bg: "bg-violet-500/10", border: "border-violet-500/20", hoverBorder: "hover:border-violet-500/40", badge: "bg-violet-500", text: "text-violet-400" },
];

function getTimeslotLabel(timeslotIndex: number): string {
    const day = Math.floor(timeslotIndex / 9);
    const period = timeslotIndex % 9;
    const hour = 8 + period;
    return `${DAYS[day] ?? "Day"} ${hour}:00`;
}

/* ── Component ─────────────────────────────────── */

export function TimetableGrid({ entries, rooms, versionId, onRoomReassign }: TimetableGridProps) {
    const [modalEntry, setModalEntry] = useState<TimetableEntryResponse | null>(null);

    /** Look up entries for a given day (0-4) and hour (8-16) */
    const getEntry = (dayIndex: number, hour: number): TimetableEntryResponse | undefined => {
        const period = hour - 8; // 8am → period 0
        const timeslotIndex = dayIndex * 9 + period;
        return entries.find((e) => e.timeslot_index === timeslotIndex);
    };

    /** Consistent color based on course ID */
    const getColor = (courseId: number) => CARD_COLORS[courseId % CARD_COLORS.length];

    return (
        <>
            <div className="gc-card overflow-hidden">
                {/* Scrollable container with custom scrollbar */}
                <div
                    className={cn(
                        "overflow-auto max-h-[calc(100vh-14rem)]",
                        // Custom scrollbar matching slate-200 theme
                        "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5",
                        "[&::-webkit-scrollbar-track]:bg-transparent",
                        "[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full",
                        "[&::-webkit-scrollbar-thumb:hover]:bg-slate-500",
                    )}
                >
                    <div
                        className="min-w-[900px] grid"
                        style={{ gridTemplateColumns: "80px repeat(5, 1fr)" }}
                    >
                        {/* ── Header Row: TIME + Days ─────────── */}

                        {/* Top-left corner cell */}
                        <div
                            className={cn(
                                "sticky top-0 left-0 z-30",
                                "bg-slate-900/95 backdrop-blur-sm",
                                "border-b border-r border-slate-700/40",
                                "p-3 flex items-center justify-center",
                                "font-mono text-[11px] text-slate-500 uppercase tracking-widest"
                            )}
                        >
                            Time
                        </div>

                        {/* Day headers — sticky top */}
                        {DAYS.map((day, i) => (
                            <div
                                key={day}
                                className={cn(
                                    "sticky top-0 z-20",
                                    "bg-slate-900/95 backdrop-blur-sm",
                                    "border-b border-r border-slate-700/40",
                                    "p-3 text-center"
                                )}
                            >
                                <span className="text-sm font-semibold text-slate-200 hidden md:inline">
                                    {day}
                                </span>
                                <span className="text-sm font-semibold text-slate-200 md:hidden">
                                    {DAY_SHORT[i]}
                                </span>
                            </div>
                        ))}

                        {/* ── Body: Hours × Cells ─────────────── */}
                        {HOURS.map((hour) => (
                            <div key={hour} className="contents">
                                {/* Hour label — sticky left */}
                                <div
                                    className={cn(
                                        "sticky left-0 z-20",
                                        "bg-slate-900/95 backdrop-blur-sm",
                                        "border-r border-b border-slate-700/40",
                                        "p-2 flex items-start justify-center pt-4",
                                        "text-xs font-mono text-slate-500"
                                    )}
                                >
                                    {hour}:00
                                </div>

                                {/* Day cells */}
                                {DAYS.map((_, dayIndex) => {
                                    const entry = getEntry(dayIndex, hour);
                                    const color = entry ? getColor(entry.course) : null;

                                    return (
                                        <div
                                            key={`${dayIndex}-${hour}`}
                                            className={cn(
                                                "min-h-[110px] border-r border-b border-slate-800/40",
                                                "p-1 transition-colors",
                                                entry
                                                    ? "bg-slate-950/20"
                                                    : "bg-slate-950/10 hover:bg-slate-900/40"
                                            )}
                                        >
                                            {entry && color && (
                                                <CourseCardTooltip
                                                    content={
                                                        <div className="space-y-3">
                                                            <div className="flex items-start justify-between">
                                                                <div>
                                                                    <h4 className="text-slate-100 font-bold text-sm">
                                                                        {entry.course_name ?? `Course #${entry.course}`}
                                                                    </h4>
                                                                    <span
                                                                        className={cn(
                                                                            "text-[10px] font-mono px-1.5 py-0.5 rounded",
                                                                            color.text, "bg-primary/10"
                                                                        )}
                                                                    >
                                                                        {entry.course_code ?? "N/A"}
                                                                    </span>
                                                                </div>
                                                                <div className="w-7 h-7 rounded-lg bg-slate-700/50 flex items-center justify-center">
                                                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1.5 pt-1 border-t border-slate-700/30">
                                                                {entry.lecturer_name && (
                                                                    <div className="flex items-center gap-2 text-xs text-slate-300">
                                                                        <User className="w-3.5 h-3.5 text-emerald-400" />
                                                                        {entry.lecturer_name}
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-2 text-xs text-slate-300">
                                                                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                                                                    {entry.room_name ?? `Room #${entry.room}`}
                                                                </div>
                                                                {entry.group_name && (
                                                                    <div className="flex items-center gap-2 text-xs text-slate-300">
                                                                        <Users className="w-3.5 h-3.5 text-amber-400" />
                                                                        {entry.group_name}
                                                                        {entry.group_size != null && ` (${entry.group_size})`}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    }
                                                >
                                                    {/* ── Course Card ──────────────── */}
                                                    <button
                                                        onClick={() => setModalEntry(entry)}
                                                        className={cn(
                                                            "h-full w-full rounded-xl p-2.5 border cursor-pointer text-left",
                                                            "transition-all duration-300",
                                                            "hover:shadow-lg hover:-translate-y-0.5 group",
                                                            color.bg,
                                                            color.border,
                                                            color.hoverBorder
                                                        )}
                                                    >
                                                        {/* Code badge */}
                                                        <div className="flex justify-between items-start mb-1.5">
                                                            <span
                                                                className={cn(
                                                                    "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider text-white",
                                                                    color.badge
                                                                )}
                                                            >
                                                                {entry.course_code ?? "N/A"}
                                                            </span>
                                                        </div>

                                                        {/* Course name */}
                                                        <h4 className="text-xs font-semibold text-slate-200 line-clamp-2 leading-tight mb-2">
                                                            {entry.course_name ?? `Course ${entry.course}`}
                                                        </h4>

                                                        {/* Room chip */}
                                                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                            <span className="truncate">
                                                                {entry.room_name ?? `Rm #${entry.room}`}
                                                            </span>
                                                        </div>
                                                    </button>
                                                </CourseCardTooltip>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Room Reassignment Modal ──────────── */}
            {modalEntry && (
                <RoomReassignModal
                    isOpen={!!modalEntry}
                    onClose={() => setModalEntry(null)}
                    currentRoomId={modalEntry.room}
                    courseName={modalEntry.course_name ?? `Course ${modalEntry.course}`}
                    courseCode={modalEntry.course_code ?? "N/A"}
                    timeslotLabel={getTimeslotLabel(modalEntry.timeslot_index)}
                    rooms={rooms}
                    onConfirm={async (newRoomId) => {
                        await onRoomReassign(modalEntry.timeslot_index, newRoomId);
                    }}
                />
            )}
        </>
    );
}
