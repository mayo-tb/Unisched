import {
    LayoutDashboard,
    Calendar,
    BookOpen,
    Settings,
    ChevronsLeft,
    ChevronsRight,
    LogOut,
    Dna,
    X,
    SlidersHorizontal,
    MessageSquareWarning,
} from "lucide-react";
import { useView } from "../store/ViewContext";
import { useAuth } from "../store/AuthContext";
import type { ViewType } from "../store/ViewContext";
import { cn } from "../lib/utils";

interface NavItem {
    id: ViewType;
    label: string;
    icon: React.ElementType;
    subtitle: string;
}

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    onClose?: () => void;
}

/* Admin sees full system controls */
const ADMIN_NAV: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, subtitle: "Intelligence Hub" },
    { id: "timetable", label: "Schedules", icon: Calendar, subtitle: "Timetable Grid" },
    { id: "resources", label: "Resources", icon: BookOpen, subtitle: "Data & Logic" },
    { id: "complaints", label: "Complaints", icon: MessageSquareWarning, subtitle: "Staff Feedback" },
    { id: "settings", label: "Settings", icon: Settings, subtitle: "Configuration" },
];

/* Lecturers see their own views */
const LECTURER_NAV: NavItem[] = [
    { id: "my-schedule", label: "My Schedule", icon: Calendar, subtitle: "Your Timetable" },
    { id: "preferences", label: "Preferences", icon: SlidersHorizontal, subtitle: "Availability" },
    { id: "complaints", label: "Complaints", icon: MessageSquareWarning, subtitle: "Submit Feedback" },
];

export function Sidebar({ collapsed, onToggle, onClose }: SidebarProps) {
    const { currentView, setView } = useView();
    const { user, logout } = useAuth();

    const isLecturer = user?.role === "LECTURER";
    const navItems = isLecturer ? LECTURER_NAV : ADMIN_NAV;

    // User initials for avatar
    const initials = user?.name
        ? user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
        : "??";

    return (
        <aside
            className={cn(
                "h-screen bg-surface-dark border-r border-slate-800/60",
                "flex flex-col",
                "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                "w-64 lg:w-64",
                collapsed && "lg:w-[4.5rem]"
            )}
        >
            {/* ── Brand Header ─────────────────────── */}
            <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0",
                        isLecturer
                            ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-900/20"
                            : "bg-gradient-to-br from-primary to-indigo-600 shadow-primary/20"
                    )}>
                        <Dna className="w-5 h-5 text-white" />
                    </div>
                    <div
                        className={cn(
                            "overflow-hidden transition-all duration-300",
                            collapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"
                        )}
                    >
                        <h1 className="text-slate-100 font-bold text-base tracking-tight whitespace-nowrap">
                            UniSched
                        </h1>
                        <p className="text-slate-500 text-[11px] font-mono whitespace-nowrap">
                            {isLecturer ? "Staff Portal" : "Admin Portal"}
                        </p>
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        aria-label="Close sidebar"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* ── Navigation ───────────────────────── */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                                "w-full flex items-center gap-3 rounded-xl transition-all duration-200 group text-sm font-medium",
                                collapsed ? "lg:px-3 lg:py-3 lg:justify-center px-4 py-3" : "px-4 py-3",
                                isActive
                                    ? "bg-primary/10 text-sky-400 border border-primary/20 shadow-sm"
                                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent"
                            )}
                        >
                            <Icon
                                className={cn(
                                    "w-5 h-5 shrink-0 transition-colors",
                                    isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"
                                )}
                            />
                            <div
                                className={cn(
                                    "flex-1 text-left min-w-0 transition-all duration-300",
                                    collapsed && "lg:hidden"
                                )}
                            >
                                <span className="block truncate">{item.label}</span>
                                <span className={cn(
                                    "block text-[10px] truncate",
                                    isActive ? "text-sky-400/60" : "text-slate-600"
                                )}>
                                    {item.subtitle}
                                </span>
                            </div>

                            {isActive && !collapsed && (
                                <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)] hidden lg:block" />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* ── Engine Status (Admin only) ──────── */}
            {!isLecturer && (
                <div
                    className={cn(
                        "px-4 py-3 border-t border-slate-800/60 transition-all duration-300",
                        collapsed && "lg:hidden"
                    )}
                >
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40">
                        <div className="gc-led gc-led-success" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-slate-300">Engine Online</p>
                            <p className="text-[10px] text-slate-500 font-mono">GA Core v2.0</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── User Profile ─────────────────────── */}
            <div className="p-3 border-t border-slate-800/60">
                <div
                    className={cn(
                        "rounded-xl bg-slate-800/50 border border-slate-700/50",
                        "flex items-center gap-3 hover:bg-slate-800 transition-colors cursor-pointer group",
                        collapsed ? "lg:p-2 lg:justify-center p-3" : "p-3"
                    )}
                >
                    <div className={cn(
                        "w-9 h-9 rounded-full p-[1px] shrink-0",
                        isLecturer
                            ? "bg-gradient-to-tr from-emerald-500 to-teal-400"
                            : "bg-gradient-to-tr from-sky-500 to-indigo-400"
                    )}>
                        <div className="w-full h-full rounded-full bg-surface-dark flex items-center justify-center">
                            <span className={cn(
                                "font-bold text-xs",
                                isLecturer ? "text-emerald-400" : "text-sky-400"
                            )}>
                                {initials}
                            </span>
                        </div>
                    </div>
                    <div className={cn("flex-1 min-w-0", collapsed && "lg:hidden")}>
                        <p className="text-slate-200 text-sm font-medium truncate group-hover:text-white">
                            {user?.name || "User"}
                        </p>
                        <p className="text-slate-500 text-xs truncate">
                            {isLecturer ? `Staff: ${user?.staff_id || "—"}` : "System Administrator"}
                        </p>
                    </div>
                    <button
                        onClick={logout}
                        title="Sign out"
                        className={cn(collapsed && "lg:hidden")}
                    >
                        <LogOut className="w-4 h-4 text-slate-500 hover:text-rose-400 transition-colors shrink-0" />
                    </button>
                </div>
            </div>

            {/* ── Collapse Toggle (desktop only) ──── */}
            <button
                onClick={onToggle}
                className="hidden lg:flex p-3 border-t border-slate-800/60 items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-all"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {collapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5" />}
            </button>
        </aside>
    );
}
