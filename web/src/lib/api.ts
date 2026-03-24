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
    credential: string;   // staff_id or username
    password: string;
}

export interface LoginResponse {
    access: string;
    refresh: string;
    role: "ADMIN" | "LECTURER";
    staff_id: string | null;
    user_id: number;
    username: string;
    full_name: string;
}

export interface RegisterPayload {
    full_name: string;
    staff_id?: string;
    email?: string;
    password: string;
    role?: "ADMIN" | "LECTURER";
}

export const authApi = {
    login: (data: LoginPayload) =>
        api.post<LoginResponse>("/api/auth/login/", data),

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

/* ── Lecturer Self-Service ───────────────────────── */

export interface ScheduleEntry {
    course_id: number;
    room_id: number;
    timeslot_index: number;
    course_name: string;
    course_code: string;
    room_name: string;
    room_building: string;
    group_name: string;
    group_size: number;
}

export interface LecturerScheduleResponse {
    entries: ScheduleEntry[];
    version_id: string;
    fitness: number;
}

export interface ComplaintResponse {
    id: number;
    lecturer: number;
    lecturer_name: string;
    subject: string;
    description: string;
    status: "OPEN" | "RESOLVED";
    created_at: string;
}

export const lecturerApi = {
    schedule: () =>
        api.get<LecturerScheduleResponse>("/api/lecturer/schedule/"),

    getPreferences: () =>
        api.get<any>("/api/lecturer/preferences/"),

    updatePreferences: (data: Record<string, any>) =>
        api.patch<any>("/api/lecturer/preferences/", data),
};

export const complaintsApi = {
    list: () =>
        api.get<ComplaintResponse[]>("/api/complaints/"),

    create: (data: { subject: string; description: string }) =>
        api.post<ComplaintResponse>("/api/complaints/", data),

    update: (id: number, data: Partial<ComplaintResponse>) =>
        api.patch<ComplaintResponse>(`/api/complaints/${id}/`, data),
};

/* ── Departments ───────────────────────────────── */

export interface DepartmentResponse {
    id: number;
    name: string;
    workspace: string;
}

export const departmentsApi = {
    list: (wsId?: string) => {
        const params: Record<string, string> = {};
        if (wsId) params.workspace = wsId;
        return api.get<DepartmentResponse[]>('/api/resources/departments/', { params });
    },
    create: (data: { name: string; workspace: string }) =>
        api.post<DepartmentResponse>('/api/resources/departments/', data),
    delete: (id: number) => api.delete(`/api/resources/departments/${id}/`),
};

/* ── Timetable Officers ────────────────────────── */

export interface OfficerResponse {
    id: number;
    full_name: string;
    email: string;
    username: string;
    date_joined: string;
}

export interface RegisterOfficerPayload {
    full_name: string;
    email: string;
    department?: string;
}

export interface RegisterOfficerResult {
    full_name: string;
    email: string;
    department: string;
    username: string;
    generated_password: string;
}

export const officersApi = {
    list: () => api.get<OfficerResponse[]>('/api/auth/officers/'),
    register: (data: RegisterOfficerPayload) =>
        api.post<RegisterOfficerResult>('/api/auth/register-officer/', data),
};

/* ── Audit Log ────────────────────────────────── */

export interface AuditLogEntry {
    id: number;
    actor: number | null;
    actor_name: string;
    action: string;
    workspace: string | null;
    timestamp: string;
}

export const auditLogApi = {
    list: (wsId?: string) => {
        const params: Record<string, string> = {};
        if (wsId) params.workspace = wsId;
        return api.get<AuditLogEntry[]>('/api/audit-log/', { params });
    },
};
