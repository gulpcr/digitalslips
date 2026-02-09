/**
 * Transaction Service
 * Handles all transaction-related API calls
 */

import api from './api';
import { Transaction, TransactionCreate, TransactionListResponse, TransactionStats } from '../types';

export const transactionService = {
  /**
   * Get all transactions with pagination and filters
   */
  async getTransactions(params?: {
    page?: number;
    page_size?: number;
    status?: string;
    transaction_type?: string;
    customer_cnic?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<TransactionListResponse> {
    const response = await api.get<TransactionListResponse>('/transactions', { params });
    return response.data;
  },

  /**
   * Get single transaction by ID
   */
  async getTransaction(id: string): Promise<Transaction> {
    const response = await api.get<Transaction>(`/transactions/${id}`);
    return response.data;
  },

  /**
   * Create new transaction
   */
  async createTransaction(data: TransactionCreate): Promise<Transaction> {
    const response = await api.post<Transaction>('/transactions', data);
    return response.data;
  },

  /**
   * Get transaction statistics
   */
  async getStats(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<TransactionStats> {
    const response = await api.get<TransactionStats>('/transactions/stats', { params });
    return response.data;
  },

  /**
   * Get notifications for a transaction
   */
  async getNotifications(transactionId: string): Promise<{
    success: boolean;
    transaction_id: string;
    notifications: Array<{
      id: string;
      channel: string;
      status: string;
      recipient: string;
      sent_at: string | null;
      retry_count: number;
    }>;
  }> {
    const response = await api.get(`/transactions/${transactionId}/notifications`);
    return response.data;
  },
};

export default transactionService;
