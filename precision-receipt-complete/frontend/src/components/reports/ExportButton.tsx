/**
 * Export Button Component
 * Download reports as CSV
 */

import React, { useState } from 'react';
import { FiDownload, FiFile } from 'react-icons/fi';
import Button from '../ui/Button';
import { reportService } from '../../services/report.service';
import { ReportFilters, ReportType } from '../../types/report';
import toast from 'react-hot-toast';

interface ExportButtonProps {
  reportType: ReportType;
  filters?: ReportFilters;
  disabled?: boolean;
}

const REPORT_LABELS: Record<ReportType, string> = {
  summary: 'Transaction Summary',
  user_activity: 'User Activity',
  trends: 'Transaction Trends',
  branch_comparison: 'Branch Comparison',
  failed: 'Failed Transactions',
  audit: 'Audit Trail',
};

const ExportButton: React.FC<ExportButtonProps> = ({
  reportType,
  filters,
  disabled = false,
}) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await reportService.exportReport(reportType, 'csv', filters);

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${reportType}_report_${timestamp}.csv`;

      // Download
      reportService.downloadBlob(blob, filename);

      toast.success(`${REPORT_LABELS[reportType]} exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      leftIcon={exporting ? <FiFile className="animate-pulse" /> : <FiDownload />}
      onClick={handleExport}
      loading={exporting}
      disabled={disabled || exporting}
    >
      {exporting ? 'Exporting...' : 'Export CSV'}
    </Button>
  );
};

export default ExportButton;
