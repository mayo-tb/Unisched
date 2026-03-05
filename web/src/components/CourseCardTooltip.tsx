import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "../lib/utils";

/* ── TypeScript Interfaces ─────────────────────── */

interface CourseCardTooltipProps {
    /** The card element that triggers the tooltip */
    children: ReactNode;
    /** Tooltip content */
    content: ReactNode;
    /** Optional extra wrapper class */
    className?: string;
}

/* ── Component ─────────────────────────────────── */

/**
 * Wraps a CourseCard and shows a glassmorphism hover tooltip
 * with backdrop blur, white/90 bg (on dark: slate-800/90), shadow-2xl.
 */
export function CourseCardTooltip({ children, content, className }: CourseCardTooltipProps) {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState<"top" | "bottom">("top");
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (visible && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // If less than 300px above, show below
            setPosition(rect.top < 300 ? "bottom" : "top");
        }
    }, [visible]);

    return (
        <div
            ref={triggerRef}
            className={cn("relative", className)}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}

            {visible && (
                <div
                    ref={tooltipRef}
                    className={cn(
                        "absolute z-50 w-72 p-4",
                        "bg-white/90 dark:bg-slate-800/90",
                        "backdrop-blur-xl",
                        "border border-white/20 dark:border-slate-700/40",
                        "rounded-2xl shadow-2xl",
                        "animate-fade-in",
                        "pointer-events-none",
                        position === "top"
                            ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
                            : "top-full mt-2 left-1/2 -translate-x-1/2"
                    )}
                >
                    {content}
                </div>
            )}
        </div>
    );
}
