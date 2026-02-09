/**
 * API Base Configuration
 * Centralized Axios instance with interceptors
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002/api';
const API_VERSION = 'v1';

// Create Axios instance
const api = axios.create({
  baseURL: `${API_URL}/${API_VERSION}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string; message?: string }>) => {
    const message = error.response?.data?.detail
      || error.response?.data?.message
      || error.message
      || 'An error occurred';

    // Handle specific error codes
    if (error.response?.status === 401) {
      // Don't redirect for public pages
      const publicPaths = ['/deposit', '/customer/deposit', '/demo', '/setup', '/login'];
      const isPublicPage = publicPaths.some(path => window.location.pathname.startsWith(path));

      if (!isPublicPage) {
        // Token expired or invalid - only clear and redirect for authenticated pages
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');

        // Redirect to login
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action');
    } else if (error.response?.status === 404) {
      // Let the caller handle 404
    } else if (error.response?.status === 500) {
      toast.error('Server error. Please try again later.');
    }

    return Promise.reject(error);
  }
);

export default api;
export { API_URL, API_VERSION };
