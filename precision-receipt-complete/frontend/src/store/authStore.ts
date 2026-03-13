/**
 * Authentication Store (Zustand)
 * Manages user authentication state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  lastActivityAt: number;

  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string, expiresIn?: number) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
  updateActivity: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isAuthenticated: false,
      isLoading: false,
      lastActivityAt: Date.now(),

      setAuth: (user, accessToken, refreshToken, expiresIn) => {
        // Also store in localStorage for API interceptor
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);

        // Calculate expiry timestamp (expiresIn is in seconds)
        const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;

        set({
          user,
          accessToken,
          refreshToken,
          expiresAt,
          isAuthenticated: true,
          isLoading: false,
          lastActivityAt: Date.now(),
        });
      },

      clearAuth: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },

      updateActivity: () => {
        set({ lastActivityAt: Date.now() });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
