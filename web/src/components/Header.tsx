import { Bell, Search, ChevronDown, Menu } from "lucide-react";
import { cn } from "../lib/utils";

interface UserMeta {
    name: string;
    role: string;
    initials: string;
}

interface HeaderProps {
    title: string;
    subtitle?: string;
    user: UserMeta;
    onMenuClick?: () => void; // Mobile hamburger
}

export function Header({ title, subtitle, user, onMenuClick }: HeaderProps) {
    return (
        <header
            className={cn(
                "sticky top-0 z-40 h-16",
                "bg-surface-dark/80 backdrop-blur-xl",
                "border-b border-slate-800/60",
                "flex items-center justify-between px-4 sm:px-6 gap-3",
            )}
        >
            {/* ── Left: Hamburger (mobile) + Page Title ── */}
            <div className="flex items-center gap-3 min-w-0">
                {/* Hamburger — only visible on mobile */}
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors shrink-0"
                    aria-label="Open navigation menu"
                >
                    <Menu className="w-5 h-5" />
                </button>

                <div className="min-w-0">
                    <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight truncate">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-xs text-slate-500 font-mono hidden sm:block truncate">{subtitle}</p>
                    )}
                </div>
            </div>

            {/* ── Center: Search (hidden on small screens) ── */}
            <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search courses, rooms, lecturers..."
                        className={cn(
                            "w-full pl-10 pr-4 py-2",
                            "bg-slate-800/60 text-slate-300 text-sm",
                            "border border-slate-700/40 rounded-3xl",
                            "placeholder:text-slate-600",
                            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
                            "transition-all duration-200"
                        )}
                    />
                </div>
            </div>

            {/* ── Right: Notifications + Profile ─────────── */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <button className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
                </button>

                <div className="hidden sm:block h-8 w-px bg-slate-800" />

                <button className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-xl hover:bg-slate-800/60 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-indigo-500 p-[1px] shrink-0">
                        <div className="w-full h-full rounded-full bg-surface-dark flex items-center justify-center">
                            <span className="text-sky-400 font-bold text-xs">{user.initials}</span>
                        </div>
                    </div>
                    <div className="hidden lg:block text-left">
                        <p className="text-sm font-medium text-slate-200 group-hover:text-white">{user.name}</p>
                        <p className="text-fluid-xs text-slate-500">{user.role}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-500 hidden lg:block" />
                </button>
            </div>
        </header>
    );
}
