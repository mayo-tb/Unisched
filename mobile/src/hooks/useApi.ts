/**
 * Genetics Cloud — useApi Hook
 * Provides axios API client for making requests
 */

import { useMemo } from 'react';
import { api } from '../lib/api';

/**
 * useApi — Returns configured API client
 * Usage: const api = useApi(); await api.get('/endpoint');
 */
export const useApi = () => {
  return useMemo(() => {
    return {
      /**
       * GET request
       * @param url Endpoint path
       * @param config Axios config options
       */
      get: async (url: string, config?: any) => {
        return api.get(url, config);
      },

      /**
       * POST request
       * @param url Endpoint path
       * @param data Request body
       * @param config Axios config options
       */
      post: async (url: string, data?: any, config?: any) => {
        return api.post(url, data, config);
      },

      /**
       * PUT request
       * @param url Endpoint path
       * @param data Request body
       * @param config Axios config options
       */
      put: async (url: string, data?: any, config?: any) => {
        return api.put(url, data, config);
      },

      /**
       * PATCH request
       * @param url Endpoint path
       * @param data Request body
       * @param config Axios config options
       */
      patch: async (url: string, data?: any, config?: any) => {
        return api.patch(url, data, config);
      },

      /**
       * DELETE request
       * @param url Endpoint path
       * @param config Axios config options
       */
      delete: async (url: string, config?: any) => {
        return api.delete(url, config);
      },
    };
  }, []);
};

export default useApi;
