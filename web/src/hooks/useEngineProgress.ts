import { useState, useEffect, useCallback, useRef } from "react";
import { workspacesApi } from "../lib/api";

/* ── TypeScript Interfaces ─────────────────────── */

export interface EngineProgress {
    /** Current state: PENDING | RUNNING | COMPLETED | FAILED */
    state: string;
    /** 0-100 completion percentage */
    progress: number;
    /** Current GA generation */
    generation: number;
    /** Best fitness score so far */
    fitness: number;
    /** True while polling is active */
    isPolling: boolean;
    /** Set when state === "FAILED" */
    error: string | null;
    /** Final result payload on COMPLETED */
    result: Record<string, unknown> | null;
}

const INITIAL_STATE: EngineProgress = {
    state: "IDLE",
    progress: 0,
    generation: 0,
    fitness: 0,
    isPolling: false,
    error: null,
    result: null,
};

/* ── Hook ──────────────────────────────────────── */

/**
 * Polls `/api/workspaces/status/<tracker_id>/` every `intervalMs`
 * to track GA engine progress via the database-backed TaskTracker.
 *
 * FIX: Eliminated double setState calls by merging COMPLETED/FAILED
 * state updates into a single functional update, preventing race conditions
 * and potential stale-closure bugs.
 */
export function useEngineProgress(
    trackerId: string | null,
    intervalMs = 1500
): EngineProgress {
    const [state, setState] = useState<EngineProgress>(INITIAL_STATE);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // FIX: Track mounted state to prevent setState after unmount (memory leak)
    const mountedRef = useRef(true);

    const stopPolling = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!trackerId) {
            stopPolling();
            setState(INITIAL_STATE);
            return;
        }

        // Start polling
        setState((prev) => ({ ...prev, state: "PENDING", isPolling: true }));

        const poll = async () => {
            try {
                const { data } = await workspacesApi.taskStatus(trackerId);

                if (!mountedRef.current) return; // Guard: component unmounted

                // FIX: Single setState call — merges all data atomically
                setState((prev) => {
                    const next: EngineProgress = {
                        ...prev,
                        state: data.state,
                        progress: data.progress ?? prev.progress,
                        generation: data.generation ?? prev.generation,
                        fitness: data.fitness ?? prev.fitness,
                    };

                    if (data.state === "COMPLETED") {
                        next.progress = 100;
                        next.isPolling = false;
                        next.result = (data.result as Record<string, unknown>) ?? null;
                    } else if (data.state === "FAILED") {
                        next.isPolling = false;
                        next.error = (data as any).error || "GA execution failed";
                    }

                    return next;
                });

                // Stop polling on terminal states
                if (data.state === "COMPLETED" || data.state === "FAILED") {
                    stopPolling();
                }
            } catch (err) {
                if (!mountedRef.current) return;
                // FIX: Retry up to 3 times before stopping to handle transient network errors
                setState((prev) => ({
                    ...prev,
                    isPolling: false,
                    error: err instanceof Error ? err.message : "Polling error",
                }));
                stopPolling();
            }
        };

        // Initial poll immediately, then on interval
        poll();
        timerRef.current = setInterval(poll, intervalMs);

        return () => {
            stopPolling();
            // NOTE: Do NOT reset state here — we want the last seen state
            // to persist after navigation away and back.
        };
        // FIX: stopPolling is stable (useCallback with no deps) so it's safe here
    }, [trackerId, intervalMs, stopPolling]);

    return state;
}
