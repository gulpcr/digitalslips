/**
 * Transaction API Service
 * Handles all transaction-related API calls
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';
const API_VERSION = 'v1';

export interface Transaction {
  id: string;
  reference_number: string;
  transaction_type: string;
  customer_name: string;
  customer_cnic: string;
  customer_account: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface CreateTransactionData {
  transaction_type: string;
  customer_cnic: string;
  customer_account: string;
  amount: number;
  currency?: string;
  narration?: string;
  depositor_cnic?: string;
  depositor_name?: string;
  depositor_phone?: string;
}

export const transactionService = {
  /**
   * Get all transactions
   */
  async getTransactions(skip = 0, limit = 20, status?: string): Promise<Transaction[]> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });
    
    if (status) {
      params.append('status', status);
    }
    
    const response = await axios.get(
      `${API_URL}/${API_VERSION}/transactions?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Get single transaction by ID
   */
  async getTransaction(id: string): Promise<Transaction> {
    const response = await axios.get(
      `${API_URL}/${API_VERSION}/transactions/${id}`
    );
    return response.data;
  },

  /**
   * Create new transaction
   */
  async createTransaction(data: CreateTransactionData): Promise<Transaction> {
    const response = await axios.post(
      `${API_URL}/${API_VERSION}/transactions`,
      data
    );
    return response.data;
  },
};

export default transactionService;
