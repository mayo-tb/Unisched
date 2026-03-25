/**
 * Genetics Cloud — Mobile API Configuration
 * Axios instance with JWT interceptors for React Native
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const getBaseUrl = () => {
  // If we are explicitly in a development build via Expo/React Native, force local endpoints
  if (__DEV__) {
    // Android emulator needs 10.0.2.2 to reach PC localhost
    if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
    return 'http://localhost:8000'; // iOS simulator and Web
  }

  // Production fallback
  if (process.env.EXPO_PUBLIC_API_BASE) return process.env.EXPO_PUBLIC_API_BASE;
  return 'https://unisched-axpq.onrender.com';
};


const BASE_URL = getBaseUrl();

/**
 * Create axios instance for mobile with JWT handling
 */
export const createApiClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
  });

  // Request interceptor: Attach JWT token
  instance.interceptors.request.use(async (config) => {
    try {
      const tokenData = await AsyncStorage.getItem('gc_tokens');
      if (tokenData) {
        const { access } = JSON.parse(tokenData);
        if (access) {
          config.headers.Authorization = `Bearer ${access}`;
        }
      }

      // Add workspace header if available
      const wsData = await AsyncStorage.getItem('gc_workspace');
      if (wsData) {
        const { id } = JSON.parse(wsData);
        if (id) {
          config.headers['X-Workspace-Id'] = id;
        }
      }
    } catch (error) {
      console.warn('[API] Error attaching tokens:', error);
    }
    return config;
  });

  // Response interceptor: Handle 401 and refresh token
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalConfig = error.config;

      if (error.response?.status === 401 && !originalConfig._retry) {
        originalConfig._retry = true;

        try {
          const tokenData = await AsyncStorage.getItem('gc_tokens');
          if (tokenData) {
            const { refresh } = JSON.parse(tokenData);

            // Call refresh endpoint
            const response = await axios.post(
              `${BASE_URL}/api/auth/refresh/`,
              { refresh }
            );

            const { access } = response.data;

            // Update stored tokens
            await AsyncStorage.setItem(
              'gc_tokens',
              JSON.stringify({ access, refresh })
            );

            // Retry original request with new token
            originalConfig.headers.Authorization = `Bearer ${access}`;
            return instance(originalConfig);
          }
        } catch (refreshError) {
          console.error('[API] Token refresh failed:', refreshError);
          // Clear tokens and logout user
          await AsyncStorage.removeItem('gc_tokens');
          await AsyncStorage.removeItem('gc_workspace');
          // Could emit a logout event here
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// Export singleton instance
export const api = createApiClient();

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

export const lecturerApi = {
  schedule: (workspaceId?: string) => {
    const config = workspaceId ? { headers: { 'X-Workspace-Id': workspaceId } } : {};
    return api.get('/api/lecturer/schedule/', config);
  },

  getPreferences: (workspaceId?: string) => {
    const config = workspaceId ? { headers: { 'X-Workspace-Id': workspaceId } } : {};
    return api.get('/api/lecturer/preferences/', config);
  },

  updatePreferences: (data: Record<string, any>, workspaceId?: string) => {
    const config = workspaceId ? { headers: { 'X-Workspace-Id': workspaceId } } : {};
    return api.patch('/api/lecturer/preferences/', data, config);
  },
};

/* ── Complaints ──────────────────────────────────── */

export interface ComplaintResponse {
  id: number;
  lecturer: number;
  lecturer_name: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'RESOLVED';
  created_at: string;
}

export const complaintsApi = {
  list: () => api.get('/api/complaints/'),
  create: (data: { subject: string; description: string; lecturer?: number }) =>
    api.post('/api/complaints/', data),
  update: (id: number, data: any) => api.patch(`/api/complaints/${id}/`, data),
};

/* ── Timetable Officers ──────────────────────────── */

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

/* ── Audit Log ────────────────────────────────────── */

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


