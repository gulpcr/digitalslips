/**
 * Branch Comparison Table Component
 * Shows branch performance comparison (Admin only)
 */

import React from 'react';
import Table from '../../ui/Table';
import { BranchSummary } from '../../../types/report';
import { FiMapPin, FiTrendingUp, FiUsers } from 'react-icons/fi';

interface BranchComparisonTableProps {
  branches: BranchSummary[];
  totalSystemTransactions: number;
  totalSystemAmount: number;
  loading?: boolean;
}

const BranchComparisonTable: React.FC<BranchComparisonTableProps> = ({
  branches,
  totalSystemTransactions,
  totalSystemAmount,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
        <p className="mt-4 text-text-secondary">Loading branch comparison...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-accent-50 rounded-lg border border-accent">
          <div className="flex items-center gap-3">
            <FiMapPin className="w-6 h-6 text-accent" />
            <div>
              <p className="text-2xl font-bold text-accent">{branches.length}</p>
              <p className="text-sm text-text-secondary">Active Branches</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-primary/10 rounded-lg border border-primary">
          <div className="flex items-center gap-3">
            <FiTrendingUp className="w-6 h-6 text-primary" />
            <div>
              <p className="text-2xl font-bold text-primary">
                {totalSystemTransactions.toLocaleString()}
              </p>
              <p className="text-sm text-text-secondary">System Transactions</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-success-50 rounded-lg border border-success">
          <div className="flex items-center gap-3">
            <FiUsers className="w-6 h-6 text-success" />
            <div>
              <p className="text-2xl font-bold text-success">
                PKR {totalSystemAmount.toLocaleString()}
              </p>
              <p className="text-sm text-text-secondary">System Volume</p>
            </div>
          </div>
        </div>
      </div>

      {branches.length === 0 ? (
        <div className="text-center py-8 text-text-secondary">
          No branch data available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table striped hoverable>
            <Table.Head>
              <Table.Row>
                <Table.Cell header>#</Table.Cell>
                <Table.Cell header>Branch</Table.Cell>
                <Table.Cell header>Transactions</Table.Cell>
                <Table.Cell header>Volume</Table.Cell>
                <Table.Cell header>Completed</Table.Cell>
                <Table.Cell header>Failed</Table.Cell>
                <Table.Cell header>Success Rate</Table.Cell>
                <Table.Cell header>Tellers</Table.Cell>
                <Table.Cell header>Share</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {branches.map((branch, index) => {
                const sharePercent =
                  totalSystemTransactions > 0
                    ? (branch.total_transactions / totalSystemTransactions) * 100
                    : 0;

                return (
                  <Table.Row key={branch.branch_id}>
                    <Table.Cell>
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          index === 0
                            ? 'bg-warning text-white'
                            : index === 1
                            ? 'bg-gray-400 text-white'
                            : index === 2
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-200 text-text-secondary'
                        }`}
                      >
                        {index + 1}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <p className="font-medium text-text-primary">{branch.branch_name}</p>
                        <p className="text-xs text-text-secondary">{branch.branch_code}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-semibold text-text-primary">
                        {branch.total_transactions.toLocaleString()}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-semibold text-text-primary">
                        PKR {branch.total_amount.toLocaleString()}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <p className="font-medium text-success">
                          {branch.completed_count.toLocaleString()}
                        </p>
                        <p className="text-xs text-text-secondary">
                          PKR {branch.completed_amount.toLocaleString()}
                        </p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-error font-medium">
                        {branch.failed_count.toLocaleString()}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              branch.success_rate >= 90
                                ? 'bg-success'
                                : branch.success_rate >= 70
                                ? 'bg-warning'
                                : 'bg-error'
                            }`}
                            style={{ width: `${Math.min(branch.success_rate, 100)}%` }}
                          ></div>
                        </div>
                        <span
                          className={`text-sm font-medium ${
                            branch.success_rate >= 90
                              ? 'text-success'
                              : branch.success_rate >= 70
                              ? 'text-warning'
                              : 'text-error'
                          }`}
                        >
                          {branch.success_rate.toFixed(1)}%
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-medium text-accent">
                        {branch.active_tellers}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-accent"
                            style={{ width: `${Math.min(sharePercent, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-text-secondary">
                          {sharePercent.toFixed(1)}%
                        </span>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      )}
    </div>
  );
};

export default BranchComparisonTable;
