/**
 * Dashboard Page - Updated with Real API Integration
 * Demonstrates the Precision Receipt Design System with Live Data
 */

import React, { useState, useEffect } from 'react';
import { FiUser, FiDollarSign, FiFileText, FiTrendingUp, FiSearch, FiFilter } from 'react-icons/fi';
import Button from '@components/ui/Button';
import Card, { CardHeader, CardBody, CardFooter } from '@components/ui/Card';
import Input from '@components/ui/Input';
import Table from '@components/ui/Table';
import NewTransactionModal from '@components/NewTransactionModal';
import toast from 'react-hot-toast';
import { transactionService, Transaction } from '@/services/transaction.service';
import { receiptService } from '@/services/receipt.service';
import { format } from 'date-fns';

const Dashboard: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load transactions
  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await transactionService.getTransactions(0, 20);
      setTransactions(data);
    } catch (error) {
      toast.error('Failed to load transactions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadTransactions();
  }, []);

  // Handle view receipt
  const handleViewReceipt = async (transactionId: string) => {
    try {
      const receipt = await receiptService.getReceipt(transactionId);
      toast.success(`Receipt: ${receipt.receipt_number}`);
      // TODO: Show receipt in modal
    } catch (error) {
      toast.error('Failed to load receipt');
    }
  };

  // Sample stats (you can calculate these from transactions)
  const stats = [
    {
      title: 'Total Transactions',
      value: transactions.length.toString(),
      change: '+12.5%',
      trend: 'up',
      icon: FiFileText,
      color: 'accent',
    },
    {
      title: 'Total Amount',
      value: `PKR ${transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}`,
      change: '+8.3%',
      trend: 'up',
      icon: FiDollarSign,
      color: 'success',
    },
    {
      title: 'Completed',
      value: transactions.filter(t => t.status === 'COMPLETED').length.toString(),
      change: '+5.1%',
      trend: 'up',
      icon: FiTrendingUp,
      color: 'success',
    },
    {
      title: 'Success Rate',
      value: '98.4%',
      change: '+0.2%',
      trend: 'up',
      icon: FiTrendingUp,
      color: 'success',
    },
  ];

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

  return (
    <div className="min-h-screen bg-background-light">
      {/* Header */}
      <header className="bg-primary text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Precision Receipt</h1>
              <p className="text-sm text-gray-300 mt-1">Meezan Bank - Digital Transaction System</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="!text-white !border-white hover:!bg-white hover:!text-primary">
                <FiUser className="w-4 h-4" />
                Admin
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} hover shadow="md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-text-secondary font-medium">{stat.title}</p>
                  <h3 className="text-2xl font-bold text-text-primary mt-2">{stat.value}</h3>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-sm text-success font-medium">{stat.change}</span>
                    <span className="text-xs text-text-secondary">vs last month</span>
                  </div>
                </div>
                <div className="p-3 bg-accent-50 rounded-lg">
                  <stat.icon className="w-6 h-6 text-accent" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Search & Filters */}
        <Card className="mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <Input
                placeholder="Search by reference, customer name, or CNIC..."
                leftIcon={<FiSearch />}
                fullWidth
              />
            </div>
            <Button variant="outline" leftIcon={<FiFilter />}>
              Filters
            </Button>
            <Button variant="primary" onClick={() => setIsModalOpen(true)}>
              New Transaction
            </Button>
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader
            title="Recent Transactions"
            subtitle={loading ? 'Loading...' : `${transactions.length} transactions`}
            action={
              <Button variant="ghost" size="sm" onClick={loadTransactions}>
                Refresh
              </Button>
            }
          />
          
          <CardBody>
            {loading ? (
              <div className="text-center py-8 text-text-secondary">
                Loading transactions...
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                No transactions found. Create your first transaction!
              </div>
            ) : (
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
                        <span className="font-medium text-primary">{txn.reference_number}</span>
                      </Table.Cell>
                      <Table.Cell>{txn.customer_name}</Table.Cell>
                      <Table.Cell>
                        <span className="text-text-secondary">{txn.transaction_type.replace('_', ' ')}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-semibold">{txn.currency} {txn.amount.toLocaleString()}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getStatusColor(
                            txn.status
                          )}`}
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
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
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
            )}
          </CardBody>
          
          {transactions.length > 0 && (
            <CardFooter>
              <Button variant="ghost" size="sm">
                Previous
              </Button>
              <div className="text-sm text-text-secondary">
                Page 1 of {Math.ceil(transactions.length / 20)}
              </div>
              <Button variant="ghost" size="sm">
                Next
              </Button>
            </CardFooter>
          )}
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-text-secondary">
              © 2024 Meezan Bank. All rights reserved.
            </p>
            <p className="text-sm text-text-secondary">
              Built by <span className="text-accent font-medium">eDimensionz</span>
            </p>
          </div>
        </div>
      </footer>

      {/* New Transaction Modal */}
      <NewTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadTransactions}
      />
    </div>
  );
};

export default Dashboard;
