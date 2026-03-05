import { useState } from "react";
import { X, MapPin, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import type { RoomResponse } from "../lib/api";

/* ── TypeScript Interfaces ─────────────────────── */

interface RoomReassignModalProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Close handler */
    onClose: () => void;
    /** Currently assigned room ID */
    currentRoomId: number;
    /** Entry details for display */
    courseName: string;
    courseCode: string;
    timeslotLabel: string;
    /** Available rooms to choose from */
    rooms: RoomResponse[];
    /** Called when user confirms a new room */
    onConfirm: (newRoomId: number) => Promise<void>;
}

/* ── Component ─────────────────────────────────── */

export function RoomReassignModal({
    isOpen,
    onClose,
    currentRoomId,
    courseName,
    courseCode,
    timeslotLabel,
    rooms,
    onConfirm,
}: RoomReassignModalProps) {
    const [selectedRoomId, setSelectedRoomId] = useState(currentRoomId);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (selectedRoomId === currentRoomId) {
            onClose();
            return;
        }
        setIsSubmitting(true);
        try {
            await onConfirm(selectedRoomId);
            onClose();
        } catch {
            /* error handled upstream */
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            {/* Modal */}
            <div
                className={cn(
                    "w-full max-w-md mx-4",
                    "bg-slate-900/95 backdrop-blur-2xl",
                    "border border-slate-700/50",
                    "rounded-4xl shadow-2xl shadow-black/40",
                    "animate-page-in",
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-800/60">
                    <div>
                        <h2 className="text-lg font-bold text-slate-100">Reassign Room</h2>
                        <p className="text-xs text-slate-500 mt-1 font-mono">
                            {courseCode} · {timeslotLabel}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Course Info */}
                <div className="px-6 pt-4 pb-2">
                    <p className="text-sm text-slate-300">{courseName}</p>
                </div>

                {/* Room List */}
                <div className="px-6 py-3 max-h-64 overflow-y-auto space-y-2">
                    {rooms.map((room) => {
                        const isCurrent = room.id === currentRoomId;
                        const isSelected = room.id === selectedRoomId;

                        return (
                            <button
                                key={room.id}
                                onClick={() => setSelectedRoomId(room.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all duration-200 border",
                                    isSelected
                                        ? "bg-primary/10 border-primary/30 text-sky-400"
                                        : "bg-slate-800/40 border-slate-700/30 text-slate-300 hover:bg-slate-800/70"
                                )}
                            >
                                <MapPin
                                    className={cn(
                                        "w-4 h-4 shrink-0",
                                        isSelected ? "text-primary" : "text-slate-500"
                                    )}
                                />
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium block truncate">
                                        {room.name}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {room.building} · Cap {room.capacity}
                                    </span>
                                </div>
                                {isCurrent && (
                                    <span className="gc-badge gc-badge-info text-[10px]">
                                        Current
                                    </span>
                                )}
                                {isSelected && (
                                    <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                                )}
                            </button>
                        );
                    })}

                    {rooms.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-6">
                            No rooms available
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-800/60">
                    <button
                        onClick={onClose}
                        className="gc-btn-ghost"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="gc-btn-primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            "Confirm Assignment"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
