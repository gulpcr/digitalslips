/**
 * Dashboard Page - Full Implementation
 * Main dashboard with transactions, search, and modals
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FiDollarSign, FiFileText, FiTrendingUp, FiCheckCircle, FiSearch, FiRefreshCw, FiHome, FiPlus } from 'react-icons/fi';
import AdminLayout from '../components/layout/AdminLayout';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardBody, CardFooter } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Table from '../components/ui/Table';
import NewTransactionModal from '../components/NewTransactionModal';
import ReceiptModal from '../components/ReceiptModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import DRIDLookupModal from '../components/DRIDLookupModal';
import toast from 'react-hot-toast';
import { transactionService } from '../services/transaction.service';
import { useAuthStore } from '../store/authStore';
import { Transaction, TransactionListResponse } from '../types';
import { format } from 'date-fns';

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();

  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isNewTxnModalOpen, setIsNewTxnModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDRIDModalOpen, setIsDRIDModalOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string>('');

  // Stats
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalAmount: 0,
    completedCount: 0,
    successRate: 0,
  });

  // Load transactions
  const loadTransactions = useCallback(async (page = 1, search = '') => {
    try {
      setLoading(true);
      const response: TransactionListResponse = await transactionService.getTransactions({
        page,
        page_size: 10,
        search: search || undefined,
      });

      setTransactions(response.data);
      setCurrentPage(response.page);
      setTotalPages(response.total_pages);
      setTotalCount(response.total);

      // Update stats
      if (response.data.length > 0) {
        const completed = response.data.filter(t => t.status === 'COMPLETED').length;
        const totalAmt = response.data.reduce((sum, t) => sum + (parseFloat(String(t.amount)) || 0), 0);
        setStats({
          totalTransactions: response.total,
          totalAmount: totalAmt,
          completedCount: completed,
          successRate: response.total > 0 ? (completed / response.data.length) * 100 : 0,
        });
      }
    } catch (error) {
      toast.error('Failed to load transactions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Search handler with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadTransactions(1, searchQuery);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, loadTransactions]);

  // View transaction detail
  const handleViewTransaction = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    setIsDetailModalOpen(true);
  };

  // View receipt
  const handleViewReceipt = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    setIsReceiptModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-success bg-success-50 border-success';
      case 'PROCESSING':
      case 'PENDING':
        return 'text-warning bg-warning-50 border-warning';
      case 'FAILED':
      case 'CANCELLED':
        return 'text-error bg-error-50 border-error';
      default:
        return 'text-text-secondary bg-gray-50 border-border';
    }
  };

  // Get type-specific display info for transaction
  const getTransactionTypeInfo = (txn: Transaction): string => {
    const data = txn.additional_data;

    switch (txn.transaction_type) {
      case 'CASH_DEPOSIT':
        if (txn.depositor_name && txn.depositor_name !== txn.customer_name) {
          return `by ${txn.depositor_name}`;
        }
        return '';
      case 'CHEQUE_DEPOSIT':
        if (data?.cheque_number && data?.cheque_bank) {
          return `#${data.cheque_number} from ${data.cheque_bank}`;
        }
        return '';
      case 'PAY_ORDER':
        if (data?.payee_name) {
          return `for ${data.payee_name}`;
        }
        return '';
      case 'BILL_PAYMENT':
        if (data?.biller_name) {
          return `${data.biller_name}`;
        }
        return '';
      case 'FUND_TRANSFER':
        if (data?.beneficiary_name && data?.beneficiary_bank) {
          return `to ${data.beneficiary_name} (${data.beneficiary_bank})`;
        }
        return '';
      default:
        return '';
    }
  };

  const statCards = [
    {
      title: 'Total Transactions',
      value: stats.totalTransactions.toString(),
      icon: FiFileText,
      accentColor: 'border-l-primary',
      iconBg: 'bg-primary-50',
      iconColor: 'text-primary',
    },
    {
      title: 'Total Amount',
      value: `PKR ${stats.totalAmount.toLocaleString()}`,
      icon: FiDollarSign,
      accentColor: 'border-l-accent',
      iconBg: 'bg-accent-50',
      iconColor: 'text-accent',
    },
    {
      title: 'Completed',
      value: stats.completedCount.toString(),
      icon: FiCheckCircle,
      accentColor: 'border-l-success',
      iconBg: 'bg-success-50',
      iconColor: 'text-success',
    },
    {
      title: 'Success Rate',
      value: `${stats.successRate.toFixed(1)}%`,
      icon: FiTrendingUp,
      accentColor: 'border-l-gold',
      iconBg: 'bg-gold-50',
      iconColor: 'text-gold-700',
    },
  ];

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="Digital Transaction System"
      icon={<FiHome />}
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className={`bg-white rounded-lg shadow-card hover:shadow-card-hover transition-all duration-200 border-l-4 ${stat.accentColor} p-5`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-text-secondary font-medium">{stat.title}</p>
                  <h3 className="text-2xl font-bold text-text-primary mt-1.5">{stat.value}</h3>
                </div>
                <div className={`p-2.5 ${stat.iconBg} rounded-lg`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search & Actions */}
        <Card bordered>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <Input
                placeholder="Search by reference, customer name, or CNIC..."
                leftIcon={<FiSearch />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fullWidth
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                leftIcon={<FiRefreshCw />}
                onClick={() => loadTransactions(currentPage, searchQuery)}
              >
                Refresh
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIsDRIDModalOpen(true)}
              >
                DRID Lookup
              </Button>
              <Button
                variant="primary"
                leftIcon={<FiPlus />}
                onClick={() => setIsNewTxnModalOpen(true)}
              >
                New Transaction
              </Button>
            </div>
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card bordered>
          <CardHeader
            title="Recent Transactions"
            subtitle={loading ? 'Loading...' : `${totalCount} transactions`}
          />

          <CardBody>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-text-secondary text-sm">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <FiFileText className="w-12 h-12 mx-auto text-border mb-3" />
                <p className="font-medium">
                  {searchQuery
                    ? 'No transactions found matching your search.'
                    : 'No transactions found. Create your first transaction!'}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table striped hoverable>
                  <Table.Head>
                    <Table.Row>
                      <Table.Cell header>Reference</Table.Cell>
                      <Table.Cell header>Customer</Table.Cell>
                      <Table.Cell header>Type</Table.Cell>
                      <Table.Cell header>Amount</Table.Cell>
                      <Table.Cell header>Status</Table.Cell>
                      <Table.Cell header>Date/Time</Table.Cell>
                      <Table.Cell header>Actions</Table.Cell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {transactions.map((txn) => (
                      <Table.Row key={txn.id}>
                        <Table.Cell>
                          <span className="font-semibold text-primary text-sm">{txn.reference_number}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <div>
                            <p className="font-medium text-sm">{txn.customer_name}</p>
                            <p className="text-xs text-text-secondary">{txn.customer_cnic}</p>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div>
                            <span className="text-text-primary font-medium text-sm">
                              {txn.transaction_type.replace('_', ' ')}
                            </span>
                            {getTransactionTypeInfo(txn) && (
                              <p className="text-xs text-text-secondary mt-0.5">
                                {getTransactionTypeInfo(txn)}
                              </p>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="font-semibold text-sm">
                            {txn.currency} {parseFloat(String(txn.amount)).toLocaleString()}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span
                            className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(txn.status)}`}
                          >
                            {txn.status}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-sm text-text-secondary">
                            {format(new Date(txn.created_at), 'MMM dd, yyyy HH:mm')}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewTransaction(txn.id)}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewReceipt(txn.id)}
                            >
                              Receipt
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            )}
          </CardBody>

          {totalPages > 1 && (
            <CardFooter>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => loadTransactions(currentPage - 1, searchQuery)}
              >
                Previous
              </Button>
              <div className="text-sm text-text-secondary">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => loadTransactions(currentPage + 1, searchQuery)}
              >
                Next
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Modals */}
      <NewTransactionModal
        isOpen={isNewTxnModalOpen}
        onClose={() => setIsNewTxnModalOpen(false)}
        onSuccess={() => loadTransactions(1)}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        transactionId={selectedTransactionId}
      />

      <TransactionDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        transactionId={selectedTransactionId}
        onViewReceipt={(id) => {
          setIsDetailModalOpen(false);
          handleViewReceipt(id);
        }}
      />

      <DRIDLookupModal
        isOpen={isDRIDModalOpen}
        onClose={() => setIsDRIDModalOpen(false)}
        onComplete={(transactionId, receiptNumber) => {
          loadTransactions(1);
          if (transactionId) {
            handleViewReceipt(transactionId);
          }
        }}
      />
    </AdminLayout>
  );
};

export default Dashboard;
