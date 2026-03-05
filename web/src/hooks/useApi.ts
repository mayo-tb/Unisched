import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workspacesApi, resourcesApi, timetableApi } from "../lib/api";
import type { CourseResponse, RoomResponse, TimetableEntryResponse } from "../lib/api";

/* ── Workspaces ──────────────────────────────────── */

export function useWorkspaces() {
    return useQuery({
        queryKey: ["workspaces"],
        queryFn: async () => {
            const { data } = await workspacesApi.list();
            return data;
        },
    });
}

/* ── Courses ─────────────────────────────────────── */

export function useCourses(workspaceId?: string, search?: string) {
    return useQuery({
        queryKey: ["courses", workspaceId, search],
        queryFn: async () => {
            const { data } = await resourcesApi.courses(workspaceId, search);
            return data;
        },
        enabled: !!workspaceId,
    });
}

/* ── Rooms ───────────────────────────────────────── */

export function useRooms(workspaceId?: string) {
    return useQuery({
        queryKey: ["rooms", workspaceId],
        queryFn: async () => {
            const { data } = await resourcesApi.rooms(workspaceId);
            return data;
        },
        enabled: !!workspaceId,
    });
}

/* ── Timetable Entries ───────────────────────────── */

export function useTimetableEntries(versionId?: number) {
    return useQuery({
        queryKey: ["timetable-entries", versionId],
        queryFn: async () => {
            const { data } = await timetableApi.entries(versionId!);
            return data;
        },
        enabled: !!versionId,
    });
}

/* ── Patch Entry (room reassignment) ─────────────── */

export function usePatchEntry(versionId: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            entryIdx,
            payload,
        }: {
            entryIdx: number;
            payload: { room_id?: number; timeslot_index?: number };
        }) => {
            const { data } = await timetableApi.patchEntry(versionId, entryIdx, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["timetable-entries", versionId] });
        },
    });
}

/* ── Generate GA ─────────────────────────────────── */

export function useGenerateGA() {
    return useMutation({
        mutationFn: async ({
            wsId,
            populationSize,
            generations,
        }: {
            wsId: string;
            populationSize: number;
            generations: number;
        }) => {
            const { data } = await workspacesApi.generate(wsId, {
                population_size: populationSize,
                generations,
            });
            return data;
        },
    });
}
