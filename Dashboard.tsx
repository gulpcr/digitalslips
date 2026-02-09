/**
 * Dashboard Page
 * Demonstrates the Precision Receipt Design System
 */

import React from 'react';
import { FiUser, FiDollarSign, FiFileText, FiTrendingUp, FiSearch, FiFilter } from 'react-icons/fi';
import Button from '@components/ui/Button';
import Card, { CardHeader, CardBody, CardFooter } from '@components/ui/Card';
import Input from '@components/ui/Input';
import Table from '@components/ui/Table';

const Dashboard: React.FC = () => {
  // Sample data
  const stats = [
    {
      title: 'Total Transactions',
      value: '1,247',
      change: '+12.5%',
      trend: 'up',
      icon: FiFileText,
      color: 'accent',
    },
    {
      title: 'Total Amount',
      value: 'PKR 45.2M',
      change: '+8.3%',
      trend: 'up',
      icon: FiDollarSign,
      color: 'success',
    },
    {
      title: 'Active Customers',
      value: '892',
      change: '+5.1%',
      trend: 'up',
      icon: FiUser,
      color: 'primary',
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

  const recentTransactions = [
    {
      id: 1,
      reference: 'TXN-2024-001',
      customer: 'Hassan Raza',
      type: 'Cash Deposit',
      amount: 'PKR 50,000',
      status: 'Completed',
      date: '2024-01-28 10:30 AM',
    },
    {
      id: 2,
      reference: 'TXN-2024-002',
      customer: 'Aisha Tariq',
      type: 'Fund Transfer',
      amount: 'PKR 25,000',
      status: 'Processing',
      date: '2024-01-28 10:25 AM',
    },
    {
      id: 3,
      reference: 'TXN-2024-003',
      customer: 'Bilal Ahmed',
      type: 'Bill Payment',
      amount: 'PKR 15,000',
      status: 'Completed',
      date: '2024-01-28 10:20 AM',
    },
    {
      id: 4,
      reference: 'TXN-2024-004',
      customer: 'Sana Malik',
      type: 'Pay Order',
      amount: 'PKR 100,000',
      status: 'Completed',
      date: '2024-01-28 10:15 AM',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'text-success bg-success-50 border-success';
      case 'Processing':
        return 'text-warning bg-warning-50 border-warning';
      case 'Failed':
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
            <Button variant="primary">
              New Transaction
            </Button>
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader
            title="Recent Transactions"
            subtitle="Latest transaction activity"
            action={
              <Button variant="ghost" size="sm">
                View All
              </Button>
            }
          />
          
          <CardBody>
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
                {recentTransactions.map((txn) => (
                  <Table.Row key={txn.id}>
                    <Table.Cell>
                      <span className="font-medium text-primary">{txn.reference}</span>
                    </Table.Cell>
                    <Table.Cell>{txn.customer}</Table.Cell>
                    <Table.Cell>
                      <span className="text-text-secondary">{txn.type}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-semibold">{txn.amount}</span>
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
                      <span className="text-sm text-text-secondary">{txn.date}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                        <Button variant="outline" size="sm">
                          Receipt
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </CardBody>
          
          <CardFooter>
            <Button variant="ghost" size="sm">
              Previous
            </Button>
            <div className="text-sm text-text-secondary">
              Page 1 of 25
            </div>
            <Button variant="ghost" size="sm">
              Next
            </Button>
          </CardFooter>
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
    </div>
  );
};

export default Dashboard;
