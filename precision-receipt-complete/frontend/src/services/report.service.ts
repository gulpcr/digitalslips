/**
 * Report Service
 * API calls for reports endpoints
 */

import api from './api';
import type {
  ReportFilters,
  TransactionSummary,
  TransactionSummaryResponse,
  UserActivityReport,
  UserActivityResponse,
  UserActivitySummary,
  TransactionTrendReport,
  TransactionTrendResponse,
  BranchComparisonReport,
  BranchComparisonResponse,
  FailedTransactionsReport,
  FailedTransactionsResponse,
  AuditTrailReport,
  AuditTrailResponse,
  ReportType,
  ExportFormat,
} from '../types/report';

export const reportService = {
  /**
   * Get transaction summary report
   */
  async getSummary(filters?: ReportFilters): Promise<TransactionSummary> {
    const response = await api.get<TransactionSummaryResponse>('/reports/summary', { params: filters });
    return response.data.data;
  },

  /**
   * Get user activity report (Manager+ only)
   */
  async getUserActivity(filters?: ReportFilters): Promise<UserActivityReport> {
    const response = await api.get<UserActivityResponse>('/reports/user-activity', { params: filters });
    return response.data.data;
  },

  /**
   * Get current user's own activity summary
   */
  async getMyActivity(filters?: ReportFilters): Promise<UserActivitySummary> {
    const response = await api.get<UserActivitySummary>('/reports/my-activity', { params: filters });
    return response.data;
  },

  /**
   * Get transaction trends report
   */
  async getTrends(
    filters?: ReportFilters & { granularity?: 'daily' | 'weekly' | 'monthly' }
  ): Promise<TransactionTrendReport> {
    const response = await api.get<TransactionTrendResponse>('/reports/trends', { params: filters });
    return response.data.data;
  },

  /**
   * Get branch comparison report (Admin only)
   */
  async getBranchComparison(filters?: ReportFilters): Promise<BranchComparisonReport> {
    const response = await api.get<BranchComparisonResponse>('/reports/branch-comparison', { params: filters });
    return response.data.data;
  },

  /**
   * Get failed transactions report (Manager+ only)
   */
  async getFailedTransactions(
    filters?: ReportFilters & { page?: number; page_size?: number }
  ): Promise<FailedTransactionsReport> {
    const response = await api.get<FailedTransactionsResponse>('/reports/failed-transactions', { params: filters });
    return response.data.data;
  },

  /**
   * Get audit trail report (Admin/Auditor only)
   */
  async getAuditTrail(
    filters?: ReportFilters & {
      action?: string;
      entity_type?: string;
      page?: number;
      page_size?: number
    }
  ): Promise<AuditTrailReport> {
    const response = await api.get<AuditTrailResponse>('/reports/audit-trail', { params: filters });
    return response.data.data;
  },

  /**
   * Export report as CSV
   */
  async exportReport(
    reportType: ReportType,
    format: ExportFormat,
    filters?: ReportFilters
  ): Promise<Blob> {
    const response = await api.post('/reports/export',
      {
        report_type: reportType,
        format,
        filters
      },
      {
        responseType: 'blob'
      }
    );
    return response.data;
  },

  /**
   * Download exported report
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
};

export default reportService;
