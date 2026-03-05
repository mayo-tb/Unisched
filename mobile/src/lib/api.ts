/**
 * Genetics Cloud — Mobile API Configuration
 * Axios instance with JWT interceptors for React Native
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:8000';

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
