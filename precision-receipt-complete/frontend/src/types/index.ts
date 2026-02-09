/**
 * TypeScript Types for Precision Receipt
 */

// User Types
export interface User {
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

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Transaction Types
export interface Transaction {
  id: string;
  reference_number: string;
  transaction_type: string;
  transaction_category: string;
  customer_id: string;
  customer_cnic: string;
  customer_name: string;
  customer_account: string;
  depositor_cnic: string | null;
  depositor_name: string | null;
  depositor_phone: string | null;
  amount: number;
  currency: string;
  fee: number;
  tax: number;
  total_amount: number;
  status: string;
  channel: string;
  narration: string | null;
  branch_id: string;
  created_at: string;
  completed_at: string | null;
  additional_data?: Record<string, any> | null;
}

export interface TransactionCreate {
  transaction_type: string;
  customer_cnic: string;
  customer_account: string;
  amount: number;
  currency?: string;
  narration?: string;
  depositor_cnic?: string;
  depositor_name?: string;
  depositor_phone?: string;
  additional_data?: Record<string, any>;
}

// Type-specific additional data interfaces
export interface ChequeDepositData {
  cheque_number: string;
  cheque_date: string;
  cheque_bank: string;
  cheque_branch?: string;
}

export interface PayOrderData {
  payee_name: string;
  payee_cnic: string;
  payee_phone?: string;
}

export interface BillPaymentData {
  bill_type: string;
  consumer_number: string;
  biller_name: string;
  due_date?: string;
}

export interface FundTransferData {
  beneficiary_name: string;
  beneficiary_account: string;
  beneficiary_bank: string;
  beneficiary_iban?: string;
  transfer_type?: 'INTERNAL' | 'INTER_BANK';
}

export interface TransactionListResponse {
  success: boolean;
  data: Transaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TransactionStats {
  total_count: number;
  total_amount: number;
  completed_count: number;
  pending_count: number;
  failed_count: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
}

// Receipt Types
export interface Receipt {
  id: string;
  transaction_id: string;
  receipt_number: string;
  receipt_type: string;
  pdf_url: string | null;
  image_url: string | null;
  verification_url: string | null;
  verification_qr_data: string | null;
  is_verified: boolean;
  verified_count: number;
  last_verified_at: string | null;
  created_at: string;
}

export interface ReceiptDetail extends Receipt {
  reference_number: string;
  transaction_type: string;
  customer_name: string;
  customer_cnic: string;
  customer_account: string;
  amount: number;
  currency: string;
  fee: number;
  tax: number;
  total_amount: number;
  transaction_status: string;
  transaction_date: string;
  branch_name: string | null;
  depositor_name: string | null;
  narration: string | null;
}

export interface ReceiptVerifyResponse {
  success: boolean;
  is_valid: boolean;
  message: string;
  receipt: ReceiptDetail | null;
  verified_count: number;
}

// Customer Types
export interface Customer {
  id: string;
  cnic: string;
  full_name: string;
  father_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string;
  alternate_phone: string | null;
  email: string | null;
  address: string;
  city: string;
  province: string | null;
  postal_code: string | null;
  occupation: string | null;
  monthly_income: number | null;
  is_verified: boolean;
  kyc_status: string;
  is_blocked: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  account_number: string;
  account_type: string;
  account_title: string;
  account_status: string;
  currency: string;
  balance: number;
  available_balance: number;
  branch_id: string;
  created_at: string;
}

export interface CustomerWithAccounts extends Customer {
  accounts: Account[];
}

// Branch Types
export interface Branch {
  id: string;
  branch_code: string;
  branch_name: string;
  branch_type: string;
  region: string | null;
  address: string;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  phone: string;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  working_hours: Record<string, string> | null;
  is_active: boolean;
  created_at: string;
}

// Common Types
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiError {
  success: boolean;
  message: string;
  error?: string;
  errors?: unknown[];
}

// Re-export report types
export * from './report';
