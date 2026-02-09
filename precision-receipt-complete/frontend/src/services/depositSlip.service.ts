/**
 * Deposit Slip Service
 * Handles DRID (Digital Reference ID) related API calls
 */

import api from './api';

export interface DepositSlipCreate {
  transaction_type: string;
  customer_cnic: string;
  customer_account: string;
  amount: number;
  currency?: string;
  narration?: string;
  depositor_name?: string;
  depositor_cnic?: string;
  depositor_phone?: string;
  depositor_relationship?: string;
  channel?: string;
  additional_data?: Record<string, any>;
}

export interface DepositSlipResponse {
  id: string;
  drid: string;
  status: string;
  expires_at: string;
  validity_minutes: number;
  time_remaining_seconds?: number;
  transaction_type: string;
  customer_cnic: string;
  customer_account: string;
  customer_name?: string;
  amount: number;
  currency: string;
  narration?: string;
  depositor_name?: string;
  depositor_cnic?: string;
  depositor_phone?: string;
  depositor_relationship?: string;
  channel: string;
  branch_id?: string;
  branch_name?: string;
  created_at: string;
  retrieved_at?: string;
  verified_at?: string;
  completed_at?: string;
  transaction_id?: string;
  transaction_reference?: string;
  qr_code_data?: string;
  additional_data?: {
    // Cheque deposit fields
    cheque_number?: string;
    cheque_date?: string;
    cheque_bank?: string;
    cheque_branch?: string;
    cheque_payee_name?: string;
    cheque_amount_in_words?: string;
    cheque_signature_status?: string;
    cheque_image?: string;
    // Pay order fields
    payee_name?: string;
    payee_cnic?: string;
    payee_phone?: string;
    // Bill payment fields
    bill_type?: string;
    consumer_number?: string;
    biller_name?: string;
    due_date?: string;
    // Fund transfer fields
    beneficiary_name?: string;
    beneficiary_account?: string;
    beneficiary_bank?: string;
    beneficiary_iban?: string;
    transfer_type?: string;
    [key: string]: any;
  };
}

export interface DepositSlipCreateResponse {
  success: boolean;
  message: string;
  drid: string;
  expires_at: string;
  validity_minutes: number;
  qr_code_data?: string;
  instructions: string;
}

export interface DepositSlipStatusResponse {
  success: boolean;
  drid: string;
  status: string;
  is_valid: boolean;
  is_expired: boolean;
  message: string;
  time_remaining_seconds?: number;
  can_be_used: boolean;
}

export interface DepositSlipRetrieveResponse {
  success: boolean;
  message: string;
  deposit_slip?: DepositSlipResponse;
  validation_result?: {
    is_valid: boolean;
    is_expired: boolean;
    is_used: boolean;
    is_cancelled: boolean;
    status: string;
    message: string;
    time_remaining_seconds?: number;
  };
}

export interface DepositSlipCompleteResponse {
  success: boolean;
  message: string;
  drid: string;
  transaction_id: string;
  transaction_reference: string;
  receipt_number?: string;
}

export interface DepositSlipListResponse {
  success: boolean;
  data: DepositSlipResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const depositSlipService = {
  /**
   * Customer initiates a new deposit slip (Pre-Branch)
   */
  async initiate(data: DepositSlipCreate): Promise<DepositSlipCreateResponse> {
    const response = await api.post<DepositSlipCreateResponse>('/deposit-slips/initiate', data);
    return response.data;
  },

  /**
   * Check DRID status (Public endpoint)
   */
  async checkStatus(drid: string): Promise<DepositSlipStatusResponse> {
    const response = await api.get<DepositSlipStatusResponse>(`/deposit-slips/status/${drid}`);
    return response.data;
  },

  /**
   * Customer cancels their deposit slip
   */
  async cancel(drid: string, reason: string): Promise<DepositSlipResponse> {
    const response = await api.post<DepositSlipResponse>(`/deposit-slips/${drid}/cancel`, { reason });
    return response.data;
  },

  /**
   * Teller retrieves deposit slip by DRID
   */
  async retrieve(drid: string): Promise<DepositSlipRetrieveResponse> {
    // Debug: Check if token exists
    const token = localStorage.getItem('access_token');
    console.log('[DRID Retrieve] Token present:', !!token);

    const response = await api.get<DepositSlipRetrieveResponse>(`/deposit-slips/retrieve/${drid}`);
    return response.data;
  },

  /**
   * Teller verifies deposit slip details
   */
  async verify(
    drid: string,
    data: {
      amount_confirmed: boolean;
      depositor_identity_verified: boolean;
      instrument_verified?: boolean;
      notes?: string;
    }
  ): Promise<DepositSlipResponse> {
    const response = await api.post<DepositSlipResponse>(`/deposit-slips/${drid}/verify`, data);
    return response.data;
  },

  /**
   * Teller completes deposit slip and creates transaction
   */
  async complete(
    drid: string,
    data: {
      authorization_captured: boolean;
      teller_notes?: string;
    }
  ): Promise<DepositSlipCompleteResponse> {
    const response = await api.post<DepositSlipCompleteResponse>(`/deposit-slips/${drid}/complete`, data);
    return response.data;
  },

  /**
   * Teller rejects a deposit slip
   */
  async reject(drid: string, reason: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/deposit-slips/${drid}/reject`, null, {
      params: { reason },
    });
    return response.data;
  },

  /**
   * Get deposit slip by DRID
   */
  async getByDrid(drid: string): Promise<DepositSlipResponse> {
    const response = await api.get<DepositSlipResponse>(`/deposit-slips/${drid}`);
    return response.data;
  },

  /**
   * List deposit slips (with filters)
   */
  async list(params: {
    page?: number;
    page_size?: number;
    status?: string;
    customer_cnic?: string;
    drid?: string;
  }): Promise<DepositSlipListResponse> {
    const response = await api.get<DepositSlipListResponse>('/deposit-slips/', { params });
    return response.data;
  },

  /**
   * Get pending deposit slips
   */
  async getPending(): Promise<{
    success: boolean;
    count: number;
    deposit_slips: DepositSlipResponse[];
  }> {
    const response = await api.get('/deposit-slips/pending');
    return response.data;
  },

  /**
   * Send OTP to customer's phone for transaction authorization
   */
  async sendOtp(drid: string): Promise<{
    success: boolean;
    message: string;
    drid: string;
    phone_masked: string;
  }> {
    const response = await api.post(`/deposit-slips/${drid}/send-otp`);
    return response.data;
  },

  /**
   * Verify OTP entered by customer
   */
  async verifyOtp(drid: string, otp: string): Promise<{
    success: boolean;
    message: string;
    drid: string;
    verified: boolean;
  }> {
    const response = await api.post(`/deposit-slips/${drid}/verify-otp`, null, {
      params: { otp },
    });
    return response.data;
  },
};

export default depositSlipService;
