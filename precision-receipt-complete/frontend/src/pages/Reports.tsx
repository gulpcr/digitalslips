/**
 * Reports Page
 * Comprehensive reporting with role-based access
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiBarChart2,
  FiTrendingUp,
  FiUsers,
  FiAlertCircle,
  FiShield,
  FiMapPin,
  FiRefreshCw,
} from 'react-icons/fi';
import AdminLayout from '../components/layout/AdminLayout';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardBody } from '../components/ui/Card';
import ReportFilters from '../components/reports/ReportFilters';
import SummaryCards from '../components/reports/SummaryCards';
import TrendLineChart from '../components/reports/charts/TrendLineChart';
import TypeBarChart from '../components/reports/charts/TypeBarChart';
import StatusPieChart from '../components/reports/charts/StatusPieChart';
import UserActivityTable from '../components/reports/tables/UserActivityTable';
import BranchComparisonTable from '../components/reports/tables/BranchComparisonTable';
import FailedTransactionsTable from '../components/reports/tables/FailedTransactionsTable';
import AuditTrailTable from '../components/reports/tables/AuditTrailTable';
import ExportButton from '../components/reports/ExportButton';
import toast from 'react-hot-toast';
import { reportService } from '../services/report.service';
import { useAuthStore } from '../store/authStore';
import {
  ReportFilters as ReportFiltersType,
  TransactionSummary,
  TransactionTrendReport,
  UserActivityReport,
  BranchComparisonReport,
  FailedTransactionsReport,
  AuditTrailReport,
  ReportType,
} from '../types/report';

type TabType = 'summary' | 'trends' | 'user_activity' | 'branch_comparison' | 'failed' | 'audit';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  reportType: ReportType;
}

const TABS: Tab[] = [
  { id: 'summary', label: 'Summary', icon: <FiBarChart2 />, roles: ['ADMIN', 'MANAGER', 'TELLER', 'AUDITOR'], reportType: 'summary' },
  { id: 'trends', label: 'Trends', icon: <FiTrendingUp />, roles: ['ADMIN', 'MANAGER', 'TELLER', 'AUDITOR'], reportType: 'trends' },
  { id: 'user_activity', label: 'User Activity', icon: <FiUsers />, roles: ['ADMIN', 'MANAGER'], reportType: 'user_activity' },
  { id: 'branch_comparison', label: 'Branches', icon: <FiMapPin />, roles: ['ADMIN'], reportType: 'branch_comparison' },
  { id: 'failed', label: 'Failed', icon: <FiAlertCircle />, roles: ['ADMIN', 'MANAGER', 'AUDITOR'], reportType: 'failed' },
  { id: 'audit', label: 'Audit Trail', icon: <FiShield />, roles: ['ADMIN', 'AUDITOR'], reportType: 'audit' },
];

const Reports: React.FC = () => {
  const { user } = useAuthStore();
  const userRole = user?.role?.toUpperCase() || 'TELLER';

  // Filter tabs by role
  const availableTabs = TABS.filter((tab) => tab.roles.includes(userRole));

  // State
  const [activeTab, setActiveTab] = useState<TabType>(availableTabs[0]?.id || 'summary');
  const [filters, setFilters] = useState<ReportFiltersType>({});
  const [loading, setLoading] = useState(false);
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Report data
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [trends, setTrends] = useState<TransactionTrendReport | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivityReport | null>(null);
  const [branchComparison, setBranchComparison] = useState<BranchComparisonReport | null>(null);
  const [failedTransactions, setFailedTransactions] = useState<FailedTransactionsReport | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditTrailReport | null>(null);

  // Pagination state
  const [failedPage, setFailedPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  // Load data based on active tab
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'summary':
          const summaryData = await reportService.getSummary(filters);
          setSummary(summaryData);
          break;

        case 'trends':
          const trendsData = await reportService.getTrends({ ...filters, granularity });
          setTrends(trendsData);
          break;

        case 'user_activity':
          const userActivityData = await reportService.getUserActivity(filters);
          setUserActivity(userActivityData);
          break;

        case 'branch_comparison':
          const branchData = await reportService.getBranchComparison(filters);
          setBranchComparison(branchData);
          break;

        case 'failed':
          const failedData = await reportService.getFailedTransactions({
            ...filters,
            page: failedPage,
            page_size: 20,
          });
          setFailedTransactions(failedData);
          break;

        case 'audit':
          const auditData = await reportService.getAuditTrail({
            ...filters,
            page: auditPage,
            page_size: 50,
          });
          setAuditTrail(auditData);
          break;
      }
    } catch (error) {
      console.error('Failed to load report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, granularity, failedPage, auditPage]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle filter changes
  const handleApplyFilters = () => {
    setFailedPage(1);
    setAuditPage(1);
    loadData();
  };

  const handleClearFilters = () => {
    setFilters({});
    setFailedPage(1);
    setAuditPage(1);
  };

  // Get current tab's report type for export
  const currentTab = TABS.find((t) => t.id === activeTab);

  return (
    <AdminLayout
      title="Reports"
      subtitle="Analytics and insights"
      icon={<FiBarChart2 />}
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="mb-6">
          <ReportFilters
            filters={filters}
            onFilterChange={setFilters}
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            showBranchFilter={userRole === 'ADMIN' || userRole === 'AUDITOR'}
            showUserFilter={userRole === 'ADMIN' || userRole === 'MANAGER'}
            loading={loading}
          />
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 border-b border-border pb-2">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-primary hover:bg-primary-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-text-primary">Transaction Summary</h2>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<FiRefreshCw />}
                    onClick={loadData}
                    loading={loading}
                  >
                    Refresh
                  </Button>
                  <ExportButton reportType="summary" filters={filters} disabled={loading} />
                </div>
              </div>

              <SummaryCards summary={summary} loading={loading} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader title="By Transaction Type" />
                  <CardBody>
                    <TypeBarChart data={summary?.by_type || {}} loading={loading} />
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="By Status" />
                  <CardBody>
                    <StatusPieChart data={summary?.by_status || {}} loading={loading} />
                  </CardBody>
                </Card>
              </div>
            </>
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-text-primary">Transaction Trends</h2>
                <div className="flex gap-2 items-center">
                  <select
                    value={granularity}
                    onChange={(e) => setGranularity(e.target.value as 'daily' | 'weekly' | 'monthly')}
                    className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<FiRefreshCw />}
                    onClick={loadData}
                    loading={loading}
                  >
                    Refresh
                  </Button>
                  <ExportButton reportType="trends" filters={filters} disabled={loading} />
                </div>
              </div>

              <Card>
                <CardHeader
                  title="Transaction Volume Over Time"
                  subtitle={trends ? `${trends.total_transactions.toLocaleString()} transactions, PKR ${trends.total_amount.toLocaleString()}` : ''}
                />
                <CardBody>
                  <TrendLineChart data={trends?.data_points || []} loading={loading} />
                </CardBody>
              </Card>
            </>
          )}

          {/* User Activity Tab */}
          {activeTab === 'user_activity' && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-text-primary">User Activity Report</h2>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<FiRefreshCw />}
                    onClick={loadData}
                    loading={loading}
                  >
                    Refresh
                  </Button>
                  <ExportButton reportType="user_activity" filters={filters} disabled={loading} />
                </div>
              </div>

              <Card>
                <CardHeader
                  title="User Performance"
                  subtitle={userActivity ? `${userActivity.total_users_active} active users` : ''}
                />
                <CardBody>
                  <UserActivityTable users={userActivity?.users || []} loading={loading} />
                </CardBody>
              </Card>
            </>
          )}

          {/* Branch Comparison Tab */}
          {activeTab === 'branch_comparison' && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-text-primary">Branch Comparison</h2>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<FiRefreshCw />}
                    onClick={loadData}
                    loading={loading}
                  >
                    Refresh
                  </Button>
                  <ExportButton reportType="branch_comparison" filters={filters} disabled={loading} />
                </div>
              </div>

              <Card>
                <CardBody>
                  <BranchComparisonTable
                    branches={branchComparison?.branches || []}
                    totalSystemTransactions={branchComparison?.total_system_transactions || 0}
                    totalSystemAmount={branchComparison?.total_system_amount || 0}
                    loading={loading}
                  />
                </CardBody>
              </Card>
            </>
          )}

          {/* Failed Transactions Tab */}
          {activeTab === 'failed' && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-text-primary">Failed Transactions</h2>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<FiRefreshCw />}
                    onClick={loadData}
                    loading={loading}
                  >
                    Refresh
                  </Button>
                  <ExportButton reportType="failed" filters={filters} disabled={loading} />
                </div>
              </div>

              <Card>
                <CardBody>
                  <FailedTransactionsTable
                    transactions={failedTransactions?.transactions || []}
                    totalFailed={failedTransactions?.total_failed || 0}
                    totalAmount={failedTransactions?.total_failed_amount || 0}
                    page={failedPage}
                    totalPages={failedTransactions?.total_pages || 1}
                    onPageChange={(page) => setFailedPage(page)}
                    loading={loading}
                  />
                </CardBody>
              </Card>
            </>
          )}

          {/* Audit Trail Tab */}
          {activeTab === 'audit' && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-text-primary">Audit Trail</h2>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<FiRefreshCw />}
                    onClick={loadData}
                    loading={loading}
                  >
                    Refresh
                  </Button>
                  <ExportButton reportType="audit" filters={filters} disabled={loading} />
                </div>
              </div>

              <Card>
                <CardBody>
                  <AuditTrailTable
                    entries={auditTrail?.entries || []}
                    totalEntries={auditTrail?.total_entries || 0}
                    page={auditPage}
                    totalPages={auditTrail?.total_pages || 1}
                    onPageChange={(page) => setAuditPage(page)}
                    loading={loading}
                  />
                </CardBody>
              </Card>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Reports;
