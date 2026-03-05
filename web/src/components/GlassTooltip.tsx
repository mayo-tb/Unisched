import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface GlassTooltipProps {
    children: ReactNode;
    content: ReactNode;
    className?: string;
}

export function GlassTooltip({ children, content, className }: GlassTooltipProps) {
    return (
        <div className="relative group inline-block">
            {children}
            <div className={cn(
                "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-4 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 shadow-2xl skew-y-1 scale-95 opacity-0 group-hover:opacity-100 group-hover:scale-100 group-hover:skew-y-0 transition-all duration-300 z-50 pointer-events-none",
                className
            )}>
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-2 w-4 h-4 bg-slate-900 rotate-45 border-r border-b border-slate-700/50" />

                <div className="relative z-10">
                    {content}
                </div>
            </div>
        </div>
    );
}
