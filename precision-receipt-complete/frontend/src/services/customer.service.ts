/**
 * Customer Service
 * Handles customer-related API calls
 */

import api from './api';
import { Customer, CustomerWithAccounts } from '../types';

export const customerService = {
  /**
   * Get all customers with optional filters
   */
  async getCustomers(params?: {
    skip?: number;
    limit?: number;
    search?: string;
    city?: string;
  }): Promise<Customer[]> {
    const response = await api.get<Customer[]>('/customers', { params });
    return response.data;
  },

  /**
   * Search customers
   */
  async searchCustomers(params: {
    cnic?: string;
    phone?: string;
    name?: string;
  }): Promise<Customer[]> {
    const response = await api.get<Customer[]>('/customers/search', { params });
    return response.data;
  },

  /**
   * Get customer by CNIC with accounts
   */
  async getCustomerByCnic(cnic: string): Promise<CustomerWithAccounts> {
    const response = await api.get<CustomerWithAccounts>(`/customers/by-cnic/${cnic}`);
    return response.data;
  },

  /**
   * Get customer by ID with accounts
   */
  async getCustomer(customerId: string): Promise<CustomerWithAccounts> {
    const response = await api.get<CustomerWithAccounts>(`/customers/${customerId}`);
    return response.data;
  },
};

export default customerService;
