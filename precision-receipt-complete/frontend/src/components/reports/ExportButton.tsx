/**
 * Export Button Component
 * Download reports as CSV, PDF, or Excel
 */

import React, { useState, useRef, useEffect } from 'react';
import { FiDownload, FiFile, FiChevronDown } from 'react-icons/fi';
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

type ExportFormat = 'csv' | 'pdf' | 'xlsx';

const FORMAT_OPTIONS: { value: ExportFormat; label: string; ext: string }[] = [
  { value: 'csv', label: 'CSV', ext: 'csv' },
  { value: 'pdf', label: 'PDF', ext: 'pdf' },
  { value: 'xlsx', label: 'Excel', ext: 'xlsx' },
];

const ExportButton: React.FC<ExportButtonProps> = ({
  reportType,
  filters,
  disabled = false,
}) => {
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleExport = async (format: ExportFormat) => {
    setShowMenu(false);
    setExporting(true);
    try {
      const blob = await reportService.exportReport(reportType, format, filters);
      const timestamp = new Date().toISOString().slice(0, 10);
      const ext = FORMAT_OPTIONS.find((f) => f.value === format)?.ext || format;
      const filename = `${reportType}_report_${timestamp}.${ext}`;
      reportService.downloadBlob(blob, filename);
      toast.success(`${REPORT_LABELS[reportType]} exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="outline"
        size="sm"
        leftIcon={exporting ? <FiFile className="animate-pulse" /> : <FiDownload />}
        onClick={() => setShowMenu(!showMenu)}
        loading={exporting}
        disabled={disabled || exporting}
      >
        {exporting ? 'Exporting...' : 'Export'} <FiChevronDown className="ml-1 w-3 h-3" />
      </Button>

      {showMenu && (
        <div className="absolute right-0 mt-1 w-36 bg-white border border-border rounded-lg shadow-lg z-10">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
              onClick={() => handleExport(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportButton;
