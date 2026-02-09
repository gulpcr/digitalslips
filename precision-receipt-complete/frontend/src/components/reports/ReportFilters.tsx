/**
 * Report Filters Component
 * Date range and filter controls for reports
 */

import React from 'react';
import { FiCalendar, FiFilter, FiX } from 'react-icons/fi';
import Button from '../ui/Button';
import { ReportFilters as ReportFiltersType } from '../../types/report';

interface ReportFiltersProps {
  filters: ReportFiltersType;
  onFilterChange: (filters: ReportFiltersType) => void;
  onApply: () => void;
  onClear: () => void;
  showBranchFilter?: boolean;
  showUserFilter?: boolean;
  branches?: Array<{ id: string; branch_name: string }>;
  users?: Array<{ id: string; full_name: string }>;
  loading?: boolean;
}

const TRANSACTION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'CASH_DEPOSIT', label: 'Cash Deposit' },
  { value: 'CHEQUE_DEPOSIT', label: 'Cheque Deposit' },
  { value: 'PAY_ORDER', label: 'Pay Order' },
  { value: 'BILL_PAYMENT', label: 'Bill Payment' },
  { value: 'FUND_TRANSFER', label: 'Fund Transfer' },
];

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const ReportFilters: React.FC<ReportFiltersProps> = ({
  filters,
  onFilterChange,
  onApply,
  onClear,
  showBranchFilter = false,
  showUserFilter = false,
  branches = [],
  users = [],
  loading = false,
}) => {
  const handleChange = (field: keyof ReportFiltersType, value: string) => {
    onFilterChange({
      ...filters,
      [field]: value || undefined,
    });
  };

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  return (
    <div className="bg-white rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <FiFilter className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-text-primary">Filters</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Start Date
          </label>
          <div className="relative">
            <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="date"
              value={filters.start_date?.split('T')[0] || ''}
              onChange={(e) => handleChange('start_date', e.target.value ? `${e.target.value}T00:00:00` : '')}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            End Date
          </label>
          <div className="relative">
            <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="date"
              value={filters.end_date?.split('T')[0] || ''}
              onChange={(e) => handleChange('end_date', e.target.value ? `${e.target.value}T23:59:59` : '')}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
            />
          </div>
        </div>

        {/* Transaction Type */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Transaction Type
          </label>
          <select
            value={filters.transaction_type || ''}
            onChange={(e) => handleChange('transaction_type', e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm bg-white"
          >
            {TRANSACTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm bg-white"
          >
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Branch Filter (Admin only) */}
        {showBranchFilter && branches.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Branch
            </label>
            <select
              value={filters.branch_id || ''}
              onChange={(e) => handleChange('branch_id', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm bg-white"
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* User Filter (Admin/Manager only) */}
        {showUserFilter && users.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              User
            </label>
            <select
              value={filters.user_id || ''}
              onChange={(e) => handleChange('user_id', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm bg-white"
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<FiX />}
            onClick={onClear}
            disabled={loading}
          >
            Clear
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={onApply}
          loading={loading}
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
};

export default ReportFilters;
