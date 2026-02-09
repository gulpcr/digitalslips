/**
 * User Activity Table Component
 * Shows user performance metrics
 */

import React from 'react';
import Table from '../../ui/Table';
import { UserActivitySummary } from '../../../types/report';
import { format } from 'date-fns';

interface UserActivityTableProps {
  users: UserActivitySummary[];
  loading?: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'text-error bg-error-50 border-error',
  MANAGER: 'text-warning bg-warning-50 border-warning',
  TELLER: 'text-accent bg-accent-50 border-accent',
  AUDITOR: 'text-text-secondary bg-gray-100 border-border',
};

const UserActivityTable: React.FC<UserActivityTableProps> = ({ users, loading = false }) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
        <p className="mt-4 text-text-secondary">Loading user activity...</p>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary">
        No user activity data available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table striped hoverable>
        <Table.Head>
          <Table.Row>
            <Table.Cell header>User</Table.Cell>
            <Table.Cell header>Role</Table.Cell>
            <Table.Cell header>Branch</Table.Cell>
            <Table.Cell header>Transactions</Table.Cell>
            <Table.Cell header>Amount</Table.Cell>
            <Table.Cell header>Success Rate</Table.Cell>
            <Table.Cell header>Last Activity</Table.Cell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {users.map((user) => (
            <Table.Row key={user.user_id}>
              <Table.Cell>
                <div>
                  <p className="font-medium text-text-primary">{user.full_name}</p>
                  <p className="text-xs text-text-secondary">@{user.username}</p>
                </div>
              </Table.Cell>
              <Table.Cell>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${
                    ROLE_COLORS[user.role] || ROLE_COLORS.AUDITOR
                  }`}
                >
                  {user.role}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-sm text-text-secondary">
                  {user.branch_name || 'N/A'}
                </span>
              </Table.Cell>
              <Table.Cell>
                <div>
                  <p className="font-semibold text-text-primary">
                    {user.total_transactions.toLocaleString()}
                  </p>
                  <p className="text-xs text-text-secondary">
                    <span className="text-success">{user.completed_count}</span>
                    {' / '}
                    <span className="text-error">{user.failed_count}</span>
                  </p>
                </div>
              </Table.Cell>
              <Table.Cell>
                <div>
                  <p className="font-semibold text-text-primary">
                    PKR {user.total_amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-success">
                    PKR {user.completed_amount.toLocaleString()}
                  </p>
                </div>
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        user.success_rate >= 90
                          ? 'bg-success'
                          : user.success_rate >= 70
                          ? 'bg-warning'
                          : 'bg-error'
                      }`}
                      style={{ width: `${Math.min(user.success_rate, 100)}%` }}
                    ></div>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      user.success_rate >= 90
                        ? 'text-success'
                        : user.success_rate >= 70
                        ? 'text-warning'
                        : 'text-error'
                    }`}
                  >
                    {user.success_rate.toFixed(1)}%
                  </span>
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-sm text-text-secondary">
                  {user.last_transaction_at
                    ? format(new Date(user.last_transaction_at), 'MMM dd, yyyy HH:mm')
                    : 'Never'}
                </span>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
};

export default UserActivityTable;
