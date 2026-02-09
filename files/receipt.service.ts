/**
 * Receipt API Service
 * Handles all receipt-related API calls
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';
const API_VERSION = 'v1';

export interface Receipt {
  id: string;
  transaction_id: string;
  receipt_number: string;
  receipt_type: string;
  verification_url: string | null;
  created_at: string;
}

export const receiptService = {
  /**
   * Get receipt for a transaction
   */
  async getReceipt(transactionId: string): Promise<Receipt> {
    const response = await axios.get(
      `${API_URL}/${API_VERSION}/receipts/${transactionId}`
    );
    return response.data;
  },

  /**
   * Verify a receipt
   */
  async verifyReceipt(transactionId: string): Promise<{ success: boolean; message: string; verified_count: number }> {
    const response = await axios.post(
      `${API_URL}/${API_VERSION}/receipts/${transactionId}/verify`
    );
    return response.data;
  },
};

export default receiptService;
