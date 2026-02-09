/**
 * User Management Service
 * Handles user CRUD operations for admin users
 */

import api from './api';

export interface UserCreate {
  username: string;
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'ADMIN' | 'MANAGER' | 'TELLER' | 'AUDITOR';
  branch_id?: string;
}

export interface UserUpdate {
  email?: string;
  full_name?: string;
  phone?: string;
  is_active?: boolean;
  role?: 'ADMIN' | 'MANAGER' | 'TELLER' | 'AUDITOR';
  branch_id?: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'ADMIN' | 'MANAGER' | 'TELLER' | 'AUDITOR';
  branch_id: string | null;
  is_active: boolean;
  is_locked: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface UserListParams {
  role?: string;
  branch_id?: string;
  is_active?: boolean;
  skip?: number;
  limit?: number;
}

export const userService = {
  /**
   * Get all users (with optional filters)
   */
  async getUsers(params?: UserListParams): Promise<UserResponse[]> {
    const response = await api.get<UserResponse[]>('/users/', { params });
    return response.data;
  },

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserResponse> {
    const response = await api.get<UserResponse>(`/users/${userId}`);
    return response.data;
  },

  /**
   * Create new user (Admin only)
   */
  async createUser(data: UserCreate): Promise<UserResponse> {
    const response = await api.post<UserResponse>('/users/', data);
    return response.data;
  },

  /**
   * Update user (Admin only)
   */
  async updateUser(userId: string, data: UserUpdate): Promise<UserResponse> {
    const response = await api.patch<UserResponse>(`/users/${userId}`, data);
    return response.data;
  },

  /**
   * Unlock user account (Admin only)
   */
  async unlockUser(userId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(`/users/${userId}/unlock`);
    return response.data;
  },

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string): Promise<UserResponse> {
    return this.updateUser(userId, { is_active: false });
  },

  /**
   * Activate user
   */
  async activateUser(userId: string): Promise<UserResponse> {
    return this.updateUser(userId, { is_active: true });
  },
};

export default userService;
