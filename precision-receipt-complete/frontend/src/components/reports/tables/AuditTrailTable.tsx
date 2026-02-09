/**
 * Audit Trail Table Component
 * Shows system audit log entries
 */

import React from 'react';
import Table from '../../ui/Table';
import Button from '../../ui/Button';
import { AuditTrailEntry } from '../../../types/report';
import { format } from 'date-fns';
import { FiShield, FiUser, FiActivity } from 'react-icons/fi';

interface AuditTrailTableProps {
  entries: AuditTrailEntry[];
  totalEntries: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'text-success bg-success-50 border-success',
  UPDATE: 'text-accent bg-accent-50 border-accent',
  DELETE: 'text-error bg-error-50 border-error',
  LOGIN: 'text-primary bg-primary/10 border-primary',
  LOGOUT: 'text-text-secondary bg-gray-100 border-border',
  VIEW: 'text-text-secondary bg-gray-100 border-border',
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  USER: <FiUser className="w-4 h-4" />,
  TRANSACTION: <FiActivity className="w-4 h-4" />,
  SESSION: <FiShield className="w-4 h-4" />,
};

const AuditTrailTable: React.FC<AuditTrailTableProps> = ({
  entries,
  totalEntries,
  page,
  totalPages,
  onPageChange,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-text-secondary">Loading audit trail...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center justify-between mb-4 p-4 bg-accent-50 rounded-lg border border-accent">
        <div className="flex items-center gap-3">
          <FiShield className="w-6 h-6 text-accent" />
          <div>
            <p className="font-semibold text-accent">
              {totalEntries.toLocaleString()} Audit Log Entries
            </p>
            <p className="text-sm text-text-secondary">
              System activity and changes
            </p>
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-8 text-text-secondary">
          No audit log entries found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table striped hoverable>
              <Table.Head>
                <Table.Row>
                  <Table.Cell header>Date/Time</Table.Cell>
                  <Table.Cell header>User</Table.Cell>
                  <Table.Cell header>Action</Table.Cell>
                  <Table.Cell header>Entity</Table.Cell>
                  <Table.Cell header>Details</Table.Cell>
                  <Table.Cell header>IP Address</Table.Cell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {entries.map((entry) => (
                  <Table.Row key={entry.id}>
                    <Table.Cell>
                      <span className="text-sm text-text-secondary whitespace-nowrap">
                        {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm:ss')}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <p className="font-medium text-text-primary">
                          {entry.full_name || 'System'}
                        </p>
                        {entry.username && (
                          <p className="text-xs text-text-secondary">@{entry.username}</p>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${
                          ACTION_COLORS[entry.action.toUpperCase()] ||
                          'text-text-secondary bg-gray-100 border-border'
                        }`}
                      >
                        {entry.action}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        {ENTITY_ICONS[entry.entity_type.toUpperCase()] || (
                          <FiActivity className="w-4 h-4 text-text-secondary" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {entry.entity_type}
                          </p>
                          {entry.entity_id && (
                            <p className="text-xs text-text-secondary truncate max-w-[150px]">
                              {entry.entity_id}
                            </p>
                          )}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {entry.details ? (
                        <details className="cursor-pointer">
                          <summary className="text-xs text-accent hover:underline">
                            View details
                          </summary>
                          <pre className="text-xs text-text-secondary mt-1 p-2 bg-gray-50 rounded max-w-xs overflow-auto">
                            {JSON.stringify(entry.details, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-text-secondary">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-text-secondary font-mono">
                        {entry.ip_address || 'N/A'}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <div className="text-sm text-text-secondary">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuditTrailTable;
