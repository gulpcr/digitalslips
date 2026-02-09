/**
 * Failed Transactions Table Component
 * Shows list of failed/cancelled transactions
 */

import React from 'react';
import Table from '../../ui/Table';
import Button from '../../ui/Button';
import { FailedTransaction } from '../../../types/report';
import { format } from 'date-fns';
import { FiAlertCircle } from 'react-icons/fi';

interface FailedTransactionsTableProps {
  transactions: FailedTransaction[];
  totalFailed: number;
  totalAmount: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  CASH_DEPOSIT: 'Cash Deposit',
  CHEQUE_DEPOSIT: 'Cheque Deposit',
  PAY_ORDER: 'Pay Order',
  BILL_PAYMENT: 'Bill Payment',
  FUND_TRANSFER: 'Fund Transfer',
};

const FailedTransactionsTable: React.FC<FailedTransactionsTableProps> = ({
  transactions,
  totalFailed,
  totalAmount,
  page,
  totalPages,
  onPageChange,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-text-secondary">Loading failed transactions...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center justify-between mb-4 p-4 bg-error-50 rounded-lg border border-error">
        <div className="flex items-center gap-3">
          <FiAlertCircle className="w-6 h-6 text-error" />
          <div>
            <p className="font-semibold text-error">
              {totalFailed.toLocaleString()} Failed Transactions
            </p>
            <p className="text-sm text-text-secondary">
              Total Amount: PKR {totalAmount.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8 text-text-secondary">
          No failed transactions found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table striped hoverable>
              <Table.Head>
                <Table.Row>
                  <Table.Cell header>Reference</Table.Cell>
                  <Table.Cell header>Type</Table.Cell>
                  <Table.Cell header>Customer</Table.Cell>
                  <Table.Cell header>Amount</Table.Cell>
                  <Table.Cell header>Branch</Table.Cell>
                  <Table.Cell header>Processor</Table.Cell>
                  <Table.Cell header>Reason</Table.Cell>
                  <Table.Cell header>Date</Table.Cell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {transactions.map((txn) => (
                  <Table.Row key={txn.id}>
                    <Table.Cell>
                      <span className="font-medium text-primary">
                        {txn.reference_number}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm">
                        {TYPE_LABELS[txn.transaction_type] || txn.transaction_type}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <p className="font-medium text-text-primary">{txn.customer_name}</p>
                        <p className="text-xs text-text-secondary">{txn.customer_cnic}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-semibold">
                        {txn.currency} {txn.amount.toLocaleString()}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-text-secondary">
                        {txn.branch_name || 'N/A'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-text-secondary">
                        {txn.processor_name || 'N/A'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className="text-xs text-error max-w-xs truncate block"
                        title={txn.failure_reason || 'Unknown'}
                      >
                        {txn.failure_reason || 'Unknown'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-text-secondary">
                        {format(new Date(txn.created_at), 'MMM dd, yyyy HH:mm')}
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

export default FailedTransactionsTable;
