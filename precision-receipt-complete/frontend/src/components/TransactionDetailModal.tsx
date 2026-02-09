/**
 * Transaction Detail Modal
 * Displays full transaction details
 */

import React, { useState, useEffect } from 'react';
import { FiX, FiFileText, FiCheck, FiClock, FiAlertCircle } from 'react-icons/fi';
import Button from './ui/Button';
import Card from './ui/Card';
import toast from 'react-hot-toast';
import { transactionService } from '../services/transaction.service';
import { Transaction } from '../types';
import { format } from 'date-fns';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  onViewReceipt: (transactionId: string) => void;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  transactionId,
  onViewReceipt,
}) => {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    channel: string;
    status: string;
    recipient: string;
    sent_at: string | null;
  }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && transactionId) {
      loadTransaction();
    }
  }, [isOpen, transactionId]);

  const loadTransaction = async () => {
    setLoading(true);
    try {
      const txn = await transactionService.getTransaction(transactionId);
      setTransaction(txn);

      // Load notifications
      try {
        const notifData = await transactionService.getNotifications(transactionId);
        setNotifications(notifData.notifications);
      } catch {
        // Notifications might not exist yet
      }
    } catch (error) {
      toast.error('Failed to load transaction');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <FiCheck className="w-5 h-5 text-success" />;
      case 'PENDING':
      case 'PROCESSING':
        return <FiClock className="w-5 h-5 text-warning" />;
      case 'FAILED':
      case 'CANCELLED':
        return <FiAlertCircle className="w-5 h-5 text-error" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'SENT':
        return 'text-success bg-success-50 border-success';
      case 'PENDING':
      case 'PROCESSING':
      case 'SENDING':
        return 'text-warning bg-warning-50 border-warning';
      case 'FAILED':
      case 'CANCELLED':
        return 'text-error bg-error-50 border-error';
      default:
        return 'text-text-secondary bg-gray-50 border-border';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <Card padding="lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">Transaction Details</h2>
              {transaction && (
                <p className="text-sm text-text-secondary mt-1">
                  {transaction.reference_number}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
              <p className="mt-4 text-text-secondary">Loading transaction...</p>
            </div>
          ) : transaction ? (
            <>
              {/* Status and Amount */}
              <div className="flex items-center justify-between p-4 bg-background-light rounded-lg mb-6">
                <div className="flex items-center gap-3">
                  {getStatusIcon(transaction.status)}
                  <div>
                    <p className="font-semibold text-text-primary">
                      {transaction.transaction_type.replace('_', ' ')}
                    </p>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {transaction.currency} {parseFloat(String(transaction.amount)).toLocaleString()}
                  </p>
                  {(parseFloat(String(transaction.fee)) > 0 || parseFloat(String(transaction.tax)) > 0) && (
                    <p className="text-sm text-text-secondary">
                      Total: {transaction.currency} {parseFloat(String(transaction.total_amount)).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-text-primary">Customer Info</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-text-secondary">Name:</span>
                      <p className="font-medium">{transaction.customer_name}</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">CNIC:</span>
                      <p className="font-medium">{transaction.customer_cnic}</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Account:</span>
                      <p className="font-medium">{transaction.customer_account}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-text-primary">Transaction Info</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-text-secondary">Date:</span>
                      <p className="font-medium">
                        {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Channel:</span>
                      <p className="font-medium">{transaction.channel}</p>
                    </div>
                    {transaction.completed_at && (
                      <div>
                        <span className="text-text-secondary">Completed:</span>
                        <p className="font-medium">
                          {format(new Date(transaction.completed_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Depositor Info (for Cash Deposit) */}
              {transaction.depositor_name && (
                <div className="mb-6 p-4 bg-background-light rounded-lg">
                  <h3 className="font-semibold text-text-primary mb-2">Depositor Info</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-text-secondary">Name:</span>
                      <p className="font-medium">{transaction.depositor_name}</p>
                    </div>
                    {transaction.depositor_cnic && (
                      <div>
                        <span className="text-text-secondary">CNIC:</span>
                        <p className="font-medium">{transaction.depositor_cnic}</p>
                      </div>
                    )}
                    {transaction.depositor_phone && (
                      <div>
                        <span className="text-text-secondary">Phone:</span>
                        <p className="font-medium">{transaction.depositor_phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cheque Details (for Cheque Deposit) */}
              {transaction.transaction_type === 'CHEQUE_DEPOSIT' && transaction.additional_data && (
                <div className="mb-6 p-4 bg-background-light rounded-lg">
                  <h3 className="font-semibold text-text-primary mb-2">Cheque Details</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {transaction.additional_data.cheque_number && (
                      <div>
                        <span className="text-text-secondary">Cheque Number:</span>
                        <p className="font-medium">{transaction.additional_data.cheque_number}</p>
                      </div>
                    )}
                    {transaction.additional_data.cheque_bank && (
                      <div>
                        <span className="text-text-secondary">Bank:</span>
                        <p className="font-medium">{transaction.additional_data.cheque_bank}</p>
                      </div>
                    )}
                    {transaction.additional_data.cheque_date && (
                      <div>
                        <span className="text-text-secondary">Cheque Date:</span>
                        <p className="font-medium">{transaction.additional_data.cheque_date}</p>
                      </div>
                    )}
                    {transaction.additional_data.cheque_branch && (
                      <div>
                        <span className="text-text-secondary">Branch:</span>
                        <p className="font-medium">{transaction.additional_data.cheque_branch}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pay Order Details */}
              {transaction.transaction_type === 'PAY_ORDER' && transaction.additional_data && (
                <div className="mb-6 p-4 bg-background-light rounded-lg">
                  <h3 className="font-semibold text-text-primary mb-2">Pay Order Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {transaction.additional_data.payee_name && (
                      <div>
                        <span className="text-text-secondary">Payee Name:</span>
                        <p className="font-medium">{transaction.additional_data.payee_name}</p>
                      </div>
                    )}
                    {transaction.additional_data.payee_cnic && (
                      <div>
                        <span className="text-text-secondary">Payee CNIC:</span>
                        <p className="font-medium">{transaction.additional_data.payee_cnic}</p>
                      </div>
                    )}
                    {transaction.additional_data.payee_account && (
                      <div>
                        <span className="text-text-secondary">Payee Account:</span>
                        <p className="font-medium">{transaction.additional_data.payee_account}</p>
                      </div>
                    )}
                    {transaction.additional_data.pay_order_purpose && (
                      <div>
                        <span className="text-text-secondary">Purpose:</span>
                        <p className="font-medium">{transaction.additional_data.pay_order_purpose}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bill Payment Details */}
              {transaction.transaction_type === 'BILL_PAYMENT' && transaction.additional_data && (
                <div className="mb-6 p-4 bg-background-light rounded-lg">
                  <h3 className="font-semibold text-text-primary mb-2">Bill Payment Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {transaction.additional_data.biller_name && (
                      <div>
                        <span className="text-text-secondary">Biller:</span>
                        <p className="font-medium">{transaction.additional_data.biller_name}</p>
                      </div>
                    )}
                    {transaction.additional_data.biller_id && (
                      <div>
                        <span className="text-text-secondary">Biller ID:</span>
                        <p className="font-medium">{transaction.additional_data.biller_id}</p>
                      </div>
                    )}
                    {transaction.additional_data.consumer_number && (
                      <div>
                        <span className="text-text-secondary">Consumer Number:</span>
                        <p className="font-medium">{transaction.additional_data.consumer_number}</p>
                      </div>
                    )}
                    {transaction.additional_data.bill_reference && (
                      <div>
                        <span className="text-text-secondary">Bill Reference:</span>
                        <p className="font-medium">{transaction.additional_data.bill_reference}</p>
                      </div>
                    )}
                    {transaction.additional_data.bill_month && (
                      <div>
                        <span className="text-text-secondary">Bill Month:</span>
                        <p className="font-medium">{transaction.additional_data.bill_month}</p>
                      </div>
                    )}
                    {transaction.additional_data.due_date && (
                      <div>
                        <span className="text-text-secondary">Due Date:</span>
                        <p className="font-medium">{transaction.additional_data.due_date}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fund Transfer Details */}
              {transaction.transaction_type === 'FUND_TRANSFER' && transaction.additional_data && (
                <div className="mb-6 p-4 bg-background-light rounded-lg">
                  <h3 className="font-semibold text-text-primary mb-2">Transfer Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {transaction.additional_data.beneficiary_name && (
                      <div>
                        <span className="text-text-secondary">Beneficiary Name:</span>
                        <p className="font-medium">{transaction.additional_data.beneficiary_name}</p>
                      </div>
                    )}
                    {transaction.additional_data.beneficiary_bank && (
                      <div>
                        <span className="text-text-secondary">Beneficiary Bank:</span>
                        <p className="font-medium">{transaction.additional_data.beneficiary_bank}</p>
                      </div>
                    )}
                    {transaction.additional_data.beneficiary_account && (
                      <div>
                        <span className="text-text-secondary">Beneficiary Account:</span>
                        <p className="font-medium">{transaction.additional_data.beneficiary_account}</p>
                      </div>
                    )}
                    {transaction.additional_data.beneficiary_iban && (
                      <div>
                        <span className="text-text-secondary">IBAN:</span>
                        <p className="font-medium">{transaction.additional_data.beneficiary_iban}</p>
                      </div>
                    )}
                    {transaction.additional_data.transfer_purpose && (
                      <div>
                        <span className="text-text-secondary">Purpose:</span>
                        <p className="font-medium">{transaction.additional_data.transfer_purpose}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Narration */}
              {transaction.narration && (
                <div className="mb-6">
                  <h3 className="font-semibold text-text-primary mb-2">Narration</h3>
                  <p className="text-sm text-text-secondary bg-background-light p-3 rounded-lg">
                    {transaction.narration}
                  </p>
                </div>
              )}

              {/* Notifications */}
              {notifications.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-text-primary mb-3">Notifications</h3>
                  <div className="space-y-2">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="flex items-center justify-between p-3 bg-background-light rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium capitalize">
                            {notif.channel.toLowerCase()}
                          </span>
                          <span className="text-sm text-text-secondary">
                            {notif.recipient}
                          </span>
                        </div>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(notif.status)}`}>
                          {notif.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={onClose}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  leftIcon={<FiFileText />}
                  onClick={() => {
                    onClose();
                    onViewReceipt(transactionId);
                  }}
                >
                  View Receipt
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-text-secondary">
              Transaction not found
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TransactionDetailModal;
