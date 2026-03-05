import axios from "axios";

/* ── Base Axios Instance ─────────────────────────── */

const BASE_URL = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export const api = axios.create({
    baseURL: BASE_URL,
    headers: { "Content-Type": "application/json" },
});

/* Attach JWT token to every request */
api.interceptors.request.use((config) => {
    const tokens = localStorage.getItem("gc_tokens");
    if (tokens) {
        const { access } = JSON.parse(tokens);
        config.headers.Authorization = `Bearer ${access}`;
    }
    // Workspace header for scoped requests
    const ws = localStorage.getItem("gc_workspace");
    if (ws) {
        const { id } = JSON.parse(ws);
        if (id) config.headers["X-Workspace-Id"] = id;
    }
    return config;
});

/* Auto-refresh on 401 */
api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;
            const tokens = localStorage.getItem("gc_tokens");
            if (tokens) {
                try {
                    const { refresh } = JSON.parse(tokens);
                    const { data } = await axios.post(`${BASE_URL}/api/auth/login/refresh/`, { refresh });
                    localStorage.setItem(
                        "gc_tokens",
                        JSON.stringify({ access: data.access, refresh })
                    );
                    original.headers.Authorization = `Bearer ${data.access}`;
                    return api(original);
                } catch {
                    localStorage.removeItem("gc_tokens");
                    window.location.href = "/";
                }
            }
        }
        return Promise.reject(error);
    }
);

/* ── Auth ─────────────────────────────────────────── */

export interface LoginPayload {
    username: string;
    password: string;
}

export interface RegisterPayload {
    username: string;
    password: string;
    email: string;
    role?: "admin" | "faculty";
}

export const authApi = {
    login: (data: LoginPayload) =>
        api.post<{ access: string; refresh: string }>("/api/auth/login/", data),

    register: (data: RegisterPayload) =>
        api.post("/api/auth/register/", data),

    me: () => api.get("/api/auth/me/"),
};

/* ── Workspaces ──────────────────────────────────── */

export interface WorkspaceResponse {
    id: string;
    name: string;
    owner: number;
    course_count: number;
    created_at: string;
}

export const workspacesApi = {
    list: () =>
        api.get<WorkspaceResponse[]>("/api/workspaces/"),

    create: (name: string) =>
        api.post<WorkspaceResponse>("/api/workspaces/", { name }),

    generate: (wsId: string, params: { population_size: number; generations: number }) =>
        api.post<{ task_id: string }>(`/api/workspaces/${wsId}/generate/`, params),

    taskStatus: (taskId: string) =>
        api.get<{
            state: string;
            progress?: number;
            generation?: number;
            fitness?: number;
            result?: Record<string, unknown>;
        }>(`/api/workspaces/status/${taskId}/`),

    active: () => {
        const ws = localStorage.getItem("gc_workspace");
        return ws ? JSON.parse(ws) : null;
    }
};

/* ── Resources ───────────────────────────────────── */

export interface LecturerResponse {
    id: number;
    name: string;
    email: string;
    department: string;
    preferences?: Record<string, any>;
    workspace: string;
}

export interface CourseResponse {
    id: number;
    code: string;
    name: string;
    description: string;
    duration_hours: number;
    lecturer: number;
    student_group: number;
    workspace: string;
}

export interface RoomResponse {
    id: number;
    name: string;
    capacity: number;
    building: string;
    workspace: string;
}

export interface StudentGroupResponse {
    id: number;
    name: string;
    size: number;
    workspace: string;
}

export const resourcesApi = {
    lecturers: {
        list: (wsId?: string) => {
            const params: Record<string, string> = {};
            if (wsId) params.workspace = wsId;
            return api.get<LecturerResponse[]>("/api/resources/lecturers/", { params });
        },
        create: (data: Partial<LecturerResponse> & { workspace: string }) =>
            api.post<LecturerResponse>("/api/resources/lecturers/", data),
        delete: (id: number) => api.delete(`/api/resources/lecturers/${id}/`),
    },

    courses: {
        list: (wsId?: string, search?: string) => {
            const params: Record<string, string> = {};
            if (wsId) params.workspace = wsId;
            if (search) params.search = search;
            return api.get<CourseResponse[]>("/api/resources/courses/", { params });
        },
        create: (data: Partial<CourseResponse> & { workspace: string }) =>
            api.post<CourseResponse>("/api/resources/courses/", data),
        delete: (id: number) => api.delete(`/api/resources/courses/${id}/`),
    },

    rooms: {
        list: (wsId?: string) => {
            const params: Record<string, string> = {};
            if (wsId) params.workspace = wsId;
            return api.get<RoomResponse[]>("/api/resources/rooms/", { params });
        },
        create: (data: Partial<RoomResponse> & { workspace: string }) =>
            api.post<RoomResponse>("/api/resources/rooms/", data),
        delete: (id: number) => api.delete(`/api/resources/rooms/${id}/`),
    },

    groups: {
        list: (wsId?: string) => {
            const params: Record<string, string> = {};
            if (wsId) params.workspace = wsId;
            return api.get<StudentGroupResponse[]>("/api/resources/student-groups/", { params });
        },
        create: (data: Partial<StudentGroupResponse> & { workspace: string }) =>
            api.post<StudentGroupResponse>("/api/resources/student-groups/", data),
        delete: (id: number) => api.delete(`/api/resources/student-groups/${id}/`),
    },
};

/* ── Timetable Entries ───────────────────────────── */

export interface TimetableEntryResponse {
    id: number;
    version: number;
    course: number;
    room: number;
    timeslot_index: number;
    course_name?: string;
    course_code?: string;
    room_name?: string;
    lecturer_name?: string;
    group_name?: string;
    group_size?: number;
}

export const timetableApi = {
    entries: (versionId: number) =>
        api.get<TimetableEntryResponse[]>(`/api/timetable/entries/${versionId}/`),

    patchEntry: (versionId: number, entryIdx: number, data: { room_id?: number; timeslot_index?: number }) =>
        api.patch<TimetableEntryResponse>(`/api/timetable/entries/${versionId}/${entryIdx}/`, data),
};
