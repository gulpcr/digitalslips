/**
 * Report Types for Precision Receipt System
 */

export interface ReportFilters {
  start_date?: string;
  end_date?: string;
  transaction_type?: string;
  status?: string;
  branch_id?: string;
  user_id?: string;
}

// ============================================
// TRANSACTION SUMMARY TYPES
// ============================================

export interface TypeBreakdown {
  count: number;
  amount: number;
}

export interface StatusBreakdown {
  count: number;
  amount: number;
}

export interface TransactionSummary {
  period_start: string | null;
  period_end: string | null;
  total_count: number;
  total_amount: number;
  completed_count: number;
  completed_amount: number;
  pending_count: number;
  pending_amount: number;
  failed_count: number;
  failed_amount: number;
  cancelled_count: number;
  cancelled_amount: number;
  average_amount: number;
  by_type: Record<string, TypeBreakdown>;
  by_status: Record<string, StatusBreakdown>;
}

export interface TransactionSummaryResponse {
  success: boolean;
  data: TransactionSummary;
}

// ============================================
// USER ACTIVITY TYPES
// ============================================

export interface UserActivitySummary {
  user_id: string;
  username: string;
  full_name: string;
  role: string;
  branch_id: string | null;
  branch_name: string | null;
  total_transactions: number;
  total_amount: number;
  completed_count: number;
  completed_amount: number;
  failed_count: number;
  failed_amount: number;
  success_rate: number;
  first_transaction_at: string | null;
  last_transaction_at: string | null;
}

export interface UserActivityReport {
  period_start: string | null;
  period_end: string | null;
  users: UserActivitySummary[];
  total_users_active: number;
}

export interface UserActivityResponse {
  success: boolean;
  data: UserActivityReport;
}

// ============================================
// TREND TYPES
// ============================================

export interface TrendDataPoint {
  period: string;
  period_label: string;
  transaction_count: number;
  total_amount: number;
  completed_count: number;
  completed_amount: number;
  failed_count: number;
  pending_count: number;
}

export interface TransactionTrendReport {
  period_start: string | null;
  period_end: string | null;
  granularity: 'daily' | 'weekly' | 'monthly';
  data_points: TrendDataPoint[];
  total_transactions: number;
  total_amount: number;
}

export interface TransactionTrendResponse {
  success: boolean;
  data: TransactionTrendReport;
}

// ============================================
// BRANCH COMPARISON TYPES
// ============================================

export interface BranchSummary {
  branch_id: string;
  branch_code: string;
  branch_name: string;
  total_transactions: number;
  total_amount: number;
  completed_count: number;
  completed_amount: number;
  failed_count: number;
  success_rate: number;
  active_tellers: number;
}

export interface BranchComparisonReport {
  period_start: string | null;
  period_end: string | null;
  branches: BranchSummary[];
  total_system_transactions: number;
  total_system_amount: number;
}

export interface BranchComparisonResponse {
  success: boolean;
  data: BranchComparisonReport;
}

// ============================================
// FAILED TRANSACTIONS TYPES
// ============================================

export interface FailedTransaction {
  id: string;
  reference_number: string;
  transaction_type: string;
  customer_name: string;
  customer_cnic: string;
  amount: number;
  currency: string;
  branch_id: string | null;
  branch_name: string | null;
  processed_by: string | null;
  processor_name: string | null;
  failure_reason: string | null;
  created_at: string;
  failed_at: string | null;
}

export interface FailedTransactionsReport {
  period_start: string | null;
  period_end: string | null;
  total_failed: number;
  total_failed_amount: number;
  transactions: FailedTransaction[];
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FailedTransactionsResponse {
  success: boolean;
  data: FailedTransactionsReport;
}

// ============================================
// AUDIT TRAIL TYPES
// ============================================

export interface AuditTrailEntry {
  id: string;
  user_id: string | null;
  username: string | null;
  full_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditTrailReport {
  period_start: string | null;
  period_end: string | null;
  total_entries: number;
  entries: AuditTrailEntry[];
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditTrailResponse {
  success: boolean;
  data: AuditTrailReport;
}

// ============================================
// EXPORT TYPES
// ============================================

export type ReportType = 'summary' | 'user_activity' | 'trends' | 'branch_comparison' | 'failed' | 'audit';
export type ExportFormat = 'csv' | 'pdf';

export interface ExportRequest {
  report_type: ReportType;
  format: ExportFormat;
  filters?: ReportFilters;
}
