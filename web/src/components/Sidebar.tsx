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
} from "lucide-react";
import { useView } from "../store/ViewContext";
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
    onClose?: () => void; // Mobile close
}

const NAV_ITEMS: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, subtitle: "Intelligence Hub" },
    { id: "timetable", label: "Schedules", icon: Calendar, subtitle: "Timetable Grid" },
    { id: "resources", label: "Resources", icon: BookOpen, subtitle: "Data & Logic" },
    { id: "settings", label: "Settings", icon: Settings, subtitle: "Configuration" },
];

export function Sidebar({ collapsed, onToggle, onClose }: SidebarProps) {
    const { currentView, setView } = useView();

    return (
        <aside
            className={cn(
                "h-screen bg-surface-dark border-r border-slate-800/60",
                "flex flex-col",
                "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                // Mobile always full width when open; desktop respects collapse
                "w-64 lg:w-64",
                collapsed && "lg:w-[4.5rem]"
            )}
        >
            {/* ── Brand Header ─────────────────────── */}
            <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                        <Dna className="w-5 h-5 text-white" />
                    </div>
                    <div
                        className={cn(
                            "overflow-hidden transition-all duration-300",
                            collapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"
                        )}
                    >
                        <h1 className="text-slate-100 font-bold text-base tracking-tight whitespace-nowrap">
                            Genetics Cloud
                        </h1>
                        <p className="text-slate-500 text-[11px] font-mono whitespace-nowrap">
                            v2.4.0 Enterprise
                        </p>
                    </div>
                </div>
                {/* Mobile close button */}
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
                {NAV_ITEMS.map((item) => {
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

                            {/* Label: always visible on mobile, hidden when collapsed on desktop */}
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

            {/* ── Engine Status ────────────────────── */}
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

            {/* ── User Profile ─────────────────────── */}
            <div className="p-3 border-t border-slate-800/60">
                <div
                    className={cn(
                        "rounded-xl bg-slate-800/50 border border-slate-700/50",
                        "flex items-center gap-3 hover:bg-slate-800 transition-colors cursor-pointer group",
                        collapsed ? "lg:p-2 lg:justify-center p-3" : "p-3"
                    )}
                >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-[1px] shrink-0">
                        <div className="w-full h-full rounded-full bg-surface-dark flex items-center justify-center">
                            <span className="text-emerald-400 font-bold text-xs">AD</span>
                        </div>
                    </div>
                    <div className={cn("flex-1 min-w-0", collapsed && "lg:hidden")}>
                        <p className="text-slate-200 text-sm font-medium truncate group-hover:text-white">Admin</p>
                        <p className="text-slate-500 text-xs truncate">System Admin</p>
                    </div>
                    <LogOut className={cn(
                        "w-4 h-4 text-slate-500 hover:text-rose-400 transition-colors shrink-0",
                        collapsed && "lg:hidden"
                    )} />
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
