/**
 * Branch Service
 * API calls for branch management
 */

import api from './api';
import { Branch } from '../types';

export interface BranchCreate {
  branch_code: string;
  branch_name: string;
  branch_type: 'MAIN' | 'SUB' | 'REGIONAL';
  region?: string;
  address: string;
  city: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone: string;
  email?: string;
}

export interface BranchUpdate {
  branch_name?: string;
  branch_type?: 'MAIN' | 'SUB' | 'REGIONAL';
  region?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
}

export const branchService = {
  /**
   * Get all branches
   */
  async getBranches(params?: {
    city?: string;
    region?: string;
    is_active?: boolean;
  }): Promise<Branch[]> {
    const response = await api.get<Branch[]>('/branches', { params });
    return response.data;
  },

  /**
   * Get branch by ID
   */
  async getBranchById(branchId: string): Promise<Branch> {
    const response = await api.get<Branch>(`/branches/${branchId}`);
    return response.data;
  },

  /**
   * Get branch by code
   */
  async getBranchByCode(branchCode: string): Promise<Branch> {
    const response = await api.get<Branch>(`/branches/code/${branchCode}`);
    return response.data;
  },

  /**
   * Create a new branch (Admin only)
   */
  async createBranch(data: BranchCreate): Promise<Branch> {
    const response = await api.post<Branch>('/branches', data);
    return response.data;
  },

  /**
   * Update a branch (Admin only)
   */
  async updateBranch(branchId: string, data: BranchUpdate): Promise<Branch> {
    const response = await api.put<Branch>(`/branches/${branchId}`, data);
    return response.data;
  },

  /**
   * Deactivate a branch (Admin only)
   */
  async deactivateBranch(branchId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/branches/${branchId}`);
    return response.data;
  },

  /**
   * Activate a branch (Admin only)
   */
  async activateBranch(branchId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(`/branches/${branchId}/activate`);
    return response.data;
  },
};

export default branchService;
