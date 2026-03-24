import { useState, useEffect, type ReactNode } from "react";
import { Sidebar } from "../components/Sidebar";
import { Header } from "../components/Header";
import { useView } from "../store/ViewContext";
import { cn } from "../lib/utils";

interface AppLayoutProps {
    children: ReactNode;
}

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
    dashboard:    { title: "Command Hub",          subtitle: "Central hub for your academic scheduling system" },
    timetable:    { title: "Timetable",            subtitle: "View and manage generated academic timetables" },
    resources:    { title: "Manage Resources",     subtitle: "Create and manage rooms, lecturers, and courses" },
    settings:     { title: "Settings",             subtitle: "Configure constraints and scheduling preferences" },
    complaints:   { title: "Feedback & Responses", subtitle: "View and manage staff scheduling feedback" },
    officers:     { title: "Timetable Officers",   subtitle: "Register and manage timetable officer accounts" },
    "audit-log":  { title: "Audit Log",            subtitle: "Recent system activity and change history" },
    "my-schedule": { title: "My Schedule",         subtitle: "Your personal timetable for this semester" },
    preferences:  { title: "Preferences",          subtitle: "Set your scheduling availability and preferences" },
};

export function AppLayout({ children }: AppLayoutProps) {
    // On desktop: sidebar is expanded by default.
    // On mobile: sidebar is a hidden offcanvas drawer (controlled by mobileOpen).
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { currentView } = useView();

    // Close mobile drawer on view change (navigation)
    useEffect(() => {
        setMobileOpen(false);
    }, [currentView]);

    // Close drawer on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMobileOpen(false);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    const meta = PAGE_META[currentView] ?? { title: "Dashboard", subtitle: "" };

    return (
        <div className="min-h-screen bg-surface-dark text-slate-200">

            {/* ── Mobile backdrop overlay ──────────── */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* ── Sidebar ─────────────────────────── */}
            {/* Desktop: always visible, collapsible.
                Mobile: full-height offcanvas, slides in from left. */}
            <div
                className={cn(
                    "fixed left-0 top-0 h-screen z-50 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    // Mobile: off-screen unless open
                    mobileOpen ? "translate-x-0" : "-translate-x-full",
                    // Desktop: always visible
                    "lg:translate-x-0"
                )}
            >
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed((p) => !p)}
                    onClose={() => setMobileOpen(false)}
                />
            </div>

            {/* ── Main Content Area ────────────────── */}
            <div
                className={cn(
                    "flex flex-col min-h-screen",
                    "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    // Mobile: no margin (sidebar is offcanvas)
                    "lg:ml-64",
                    // Desktop collapsed
                    sidebarCollapsed && "lg:ml-[4.5rem]"
                )}
            >
                <Header
                    title={meta.title}
                    subtitle={meta.subtitle}
                    user={{ name: "Admin", role: "System Admin", initials: "AD" }}
                    onMenuClick={() => setMobileOpen((p) => !p)}
                />

                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden w-full">
                    <div className="w-full max-w-[min(95vw,1400px)] mx-auto gc-page" key={currentView}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
