/**
 * Receipt Service
 * Handles all receipt-related API calls
 */

import api from './api';
import { ReceiptDetail, ReceiptVerifyResponse } from '../types';

export const receiptService = {
  /**
   * Get receipt for a transaction
   */
  async getReceipt(transactionId: string): Promise<ReceiptDetail> {
    const response = await api.get<ReceiptDetail>(`/receipts/${transactionId}`);
    return response.data;
  },

  /**
   * Get receipt by receipt number
   */
  async getReceiptByNumber(receiptNumber: string): Promise<ReceiptDetail> {
    const response = await api.get<ReceiptDetail>(`/receipts/by-number/${receiptNumber}`);
    return response.data;
  },

  /**
   * Verify a receipt
   */
  async verifyReceipt(transactionId: string): Promise<ReceiptVerifyResponse> {
    const response = await api.post<ReceiptVerifyResponse>(`/receipts/${transactionId}/verify`);
    return response.data;
  },

  /**
   * Verify receipt by number
   */
  async verifyReceiptByNumber(receiptNumber: string): Promise<ReceiptVerifyResponse> {
    const response = await api.post<ReceiptVerifyResponse>('/receipts/verify-by-number', {
      receipt_number: receiptNumber,
    });
    return response.data;
  },

  /**
   * Get QR code for a receipt
   */
  async getQRCode(transactionId: string, format: 'base64' | 'svg' = 'base64'): Promise<{
    success: boolean;
    receipt_number: string;
    verification_url: string;
    qr_code: string;
    qr_data: Record<string, unknown>;
    format: string;
  }> {
    const response = await api.get(`/receipts/${transactionId}/qr-code`, {
      params: { format },
    });
    return response.data;
  },

  /**
   * Download receipt
   */
  async downloadReceipt(transactionId: string, format: 'json' | 'html' = 'json'): Promise<{
    success: boolean;
    format: string;
    content?: string;
    filename?: string;
    receipt?: ReceiptDetail;
  }> {
    const response = await api.get(`/receipts/${transactionId}/download`, {
      params: { format },
    });
    return response.data;
  },

  /**
   * Send receipt to WhatsApp or Email
   */
  async sendReceipt(transactionId: string, channel: 'whatsapp' | 'email' | 'sms', recipient: string): Promise<{
    success: boolean;
    message: string;
    channel: string;
    recipient: string;
  }> {
    const response = await api.post(`/receipts/${transactionId}/send`, {
      channel,
      recipient,
    });
    return response.data;
  },

  /**
   * Send receipt to customer's registered WhatsApp and Email
   */
  async sendReceiptToCustomer(
    transactionId: string,
    options: { sendWhatsapp?: boolean; sendEmail?: boolean; sendSms?: boolean } = {}
  ): Promise<{
    success: boolean;
    message: string;
    notifications: Array<{
      channel: string;
      recipient: string;
      status: string;
      sent_at: string | null;
    }>;
    receipt_number: string;
  }> {
    const response = await api.post(`/receipts/${transactionId}/send-all`, null, {
      params: {
        send_whatsapp: options.sendWhatsapp ?? true,
        send_email: options.sendEmail ?? true,
        send_sms: options.sendSms ?? false,
      },
    });
    return response.data;
  },

  /**
   * Get notification status for a receipt
   */
  async getNotificationStatus(transactionId: string): Promise<{
    success: boolean;
    transaction_id: string;
    reference_number: string;
    notifications: Array<{
      id: string;
      channel: string;
      status: string;
      recipient: string;
      sent_at: string | null;
      retry_count: number;
      provider: string | null;
      external_id: string | null;
    }>;
  }> {
    const response = await api.get(`/receipts/${transactionId}/notification-status`);
    return response.data;
  },
};

export default receiptService;
