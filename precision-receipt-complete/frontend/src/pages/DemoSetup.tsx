/**
 * Demo Setup Page
 * Create customers and accounts for demonstration
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUser, FiPlus, FiCopy, FiCheck, FiArrowRight, FiRefreshCw, FiTrash2, FiDatabase, FiUnlock } from 'react-icons/fi';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Customer {
  id: string;
  cnic: string;
  full_name: string;
  phone: string;
  accounts: {
    account_number: string;
    balance: string;
    type: string;
  }[];
}

interface CreatedCustomer {
  cnic: string;
  full_name: string;
  phone: string;
  account_number: string;
  balance: string;
}

const DemoSetup: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [createdCustomer, setCreatedCustomer] = useState<CreatedCustomer | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    cnic: '',
    full_name: '',
    phone: '',
    email: '',
    initial_balance: '100000',
  });

  // Load existing customers
  const loadCustomers = async () => {
    try {
      const response = await api.get('/demo/customers');
      setCustomers(response.data.customers);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Generate random CNIC
  const generateCNIC = () => {
    const part1 = Math.floor(10000 + Math.random() * 90000);
    const part2 = Math.floor(1000000 + Math.random() * 9000000);
    const part3 = Math.floor(1 + Math.random() * 9);
    return `${part1}-${part2}-${part3}`;
  };

  // Generate random phone
  const generatePhone = () => {
    const suffix = Math.floor(1000000 + Math.random() * 9000000);
    return `+92-300-${suffix}`;
  };

  // Auto-fill random data
  const autoFill = () => {
    const names = [
      'Ahmed Khan', 'Fatima Ali', 'Muhammad Hassan', 'Ayesha Malik',
      'Usman Tariq', 'Sana Sheikh', 'Bilal Ahmed', 'Zainab Raza',
      'Imran Siddiqui', 'Hira Nawaz', 'Omar Farooq', 'Maryam Javed'
    ];
    const randomName = names[Math.floor(Math.random() * names.length)];

    setFormData({
      cnic: generateCNIC(),
      full_name: randomName,
      phone: generatePhone(),
      email: `${randomName.toLowerCase().replace(' ', '.')}@email.com`,
      initial_balance: String(Math.floor(50000 + Math.random() * 450000)),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cnic || !formData.full_name || !formData.phone) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/demo/create-customer', {
        cnic: formData.cnic,
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email || undefined,
        initial_balance: parseFloat(formData.initial_balance) || 100000,
      });

      const data = response.data;
      setCreatedCustomer({
        cnic: data.customer.cnic,
        full_name: data.customer.full_name,
        phone: data.customer.phone,
        account_number: data.account.account_number,
        balance: data.account.balance,
      });

      toast.success(data.message);
      loadCustomers();

      // Reset form
      setFormData({
        cnic: '',
        full_name: '',
        phone: '',
        email: '',
        initial_balance: '100000',
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const resetDemoData = async () => {
    if (!confirm('This will delete all deposit slips. Continue?')) return;

    try {
      await api.delete('/demo/reset');
      toast.success('Demo data reset');
    } catch (error) {
      toast.error('Failed to reset');
    }
  };

  const seedDatabase = async () => {
    try {
      const response = await api.post('/demo/seed');
      const data = response.data;
      toast.success(data.message);

      // Show credentials
      if (data.credentials) {
        toast.success(`Admin: ${data.credentials.admin.username} / ${data.credentials.admin.password}`, { duration: 8000 });
        toast.success(`Teller: ${data.credentials.teller.username} / ${data.credentials.teller.password}`, { duration: 8000 });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to seed database');
    }
  };

  const unlockAdmin = async () => {
    try {
      const response = await api.post('/demo/unlock-admin');
      toast.success(response.data.message);
      toast.success(`Credentials: admin / Admin@123456`, { duration: 8000 });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to unlock admin');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 to-primary p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-3xl font-bold text-white">Demo Setup</h1>
          <p className="text-gray-300 mt-2">
            Create customers and accounts for demonstration
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <Button
            variant="primary"
            leftIcon={<FiDatabase />}
            onClick={seedDatabase}
          >
            Seed Database
          </Button>
          <Button
            variant="outline"
            className="!text-white !border-white hover:!bg-white hover:!text-primary"
            leftIcon={<FiUnlock />}
            onClick={unlockAdmin}
          >
            Unlock Admin
          </Button>
          <Link to="/deposit">
            <Button variant="outline" className="!text-white !border-white hover:!bg-white hover:!text-primary">
              Customer Deposit Page
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" className="!text-white !border-white hover:!bg-white hover:!text-primary">
              Teller Login
            </Button>
          </Link>
          <Button
            variant="outline"
            className="!text-white !border-white hover:!bg-white hover:!text-primary"
            leftIcon={<FiTrash2 />}
            onClick={resetDemoData}
          >
            Reset Deposit Slips
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Customer Form */}
          <Card padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">Create Customer</h2>
              <Button variant="ghost" size="sm" onClick={autoFill} leftIcon={<FiRefreshCw />}>
                Auto-Fill
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="CNIC *"
                placeholder="42101-1234567-1"
                value={formData.cnic}
                onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                required
                fullWidth
              />

              <Input
                label="Full Name *"
                placeholder="Customer full name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                fullWidth
              />

              <Input
                label="Phone *"
                placeholder="+92-300-1234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                fullWidth
              />

              <Input
                label="Email"
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                fullWidth
              />

              <Input
                label="Initial Balance (PKR)"
                type="number"
                placeholder="100000"
                value={formData.initial_balance}
                onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                fullWidth
              />

              <Button type="submit" variant="primary" fullWidth loading={loading} leftIcon={<FiPlus />}>
                Create Customer & Account
              </Button>
            </form>

            {/* Created Customer Result */}
            {createdCustomer && (
              <div className="mt-6 p-4 bg-success-50 border border-success rounded-lg">
                <div className="flex items-center gap-2 text-success mb-3">
                  <FiCheck className="w-5 h-5" />
                  <span className="font-medium">Customer Created!</span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">CNIC:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{createdCustomer.cnic}</span>
                      <button onClick={() => copyToClipboard(createdCustomer.cnic, 'CNIC')}>
                        <FiCopy className="w-4 h-4 text-text-secondary hover:text-primary" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Account:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{createdCustomer.account_number}</span>
                      <button onClick={() => copyToClipboard(createdCustomer.account_number, 'Account')}>
                        <FiCopy className="w-4 h-4 text-text-secondary hover:text-primary" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Balance:</span>
                    <span className="font-medium">PKR {parseFloat(createdCustomer.balance).toLocaleString()}</span>
                  </div>
                </div>

                <Link to="/deposit" className="block mt-4">
                  <Button variant="primary" fullWidth rightIcon={<FiArrowRight />}>
                    Create Deposit Slip
                  </Button>
                </Link>
              </div>
            )}
          </Card>

          {/* Existing Customers */}
          <Card padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">Existing Customers</h2>
              <Button variant="ghost" size="sm" onClick={loadCustomers} leftIcon={<FiRefreshCw />}>
                Refresh
              </Button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {customers.length === 0 ? (
                <p className="text-center text-text-secondary py-8">
                  No customers found. Create one!
                </p>
              ) : (
                customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="p-4 border border-border rounded-lg hover:border-accent transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <FiUser className="w-4 h-4 text-accent" />
                          <span className="font-medium">{customer.full_name}</span>
                        </div>
                        <p className="text-sm text-text-secondary mt-1">
                          CNIC: <span className="font-mono">{customer.cnic}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(customer.cnic, 'CNIC')}
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        <FiCopy className="w-4 h-4 text-text-secondary" />
                      </button>
                    </div>

                    {customer.accounts.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        {customer.accounts.map((acc, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-text-secondary">{acc.account_number}</span>
                              <button
                                onClick={() => copyToClipboard(acc.account_number, 'Account')}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                <FiCopy className="w-3 h-3 text-text-secondary" />
                              </button>
                            </div>
                            <span className="text-success font-medium">
                              PKR {parseFloat(acc.balance).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Login Credentials Info */}
        <Card padding="lg" className="mt-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">Login Credentials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-primary-50 border border-primary rounded-lg">
              <h3 className="font-semibold text-primary mb-2">Admin User</h3>
              <p className="text-sm"><span className="text-text-secondary">Username:</span> <code className="bg-white px-2 py-1 rounded">admin</code></p>
              <p className="text-sm mt-1"><span className="text-text-secondary">Password:</span> <code className="bg-white px-2 py-1 rounded">Admin@123456</code></p>
            </div>
            <div className="p-4 bg-success-50 border border-success rounded-lg">
              <h3 className="font-semibold text-success mb-2">Teller User</h3>
              <p className="text-sm"><span className="text-text-secondary">Username:</span> <code className="bg-white px-2 py-1 rounded">teller</code></p>
              <p className="text-sm mt-1"><span className="text-text-secondary">Password:</span> <code className="bg-white px-2 py-1 rounded">Teller@123</code></p>
            </div>
          </div>
          <p className="text-sm text-text-secondary mt-4">
            Click "Seed Database" button above if you haven't initialized the database yet, or "Unlock Admin" if your account is locked.
          </p>
        </Card>

        {/* Demo Flow Instructions */}
        <Card padding="lg" className="mt-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">Demo Flow</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-background-light rounded-lg">
              <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                0
              </div>
              <h3 className="font-medium mb-1">Seed Database</h3>
              <p className="text-sm text-text-secondary">
                Click "Seed Database" to create admin/teller users
              </p>
            </div>
            <div className="text-center p-4 bg-background-light rounded-lg">
              <div className="w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                1
              </div>
              <h3 className="font-medium mb-1">Create Customer</h3>
              <p className="text-sm text-text-secondary">
                Use this page to create a new customer with account
              </p>
            </div>
            <div className="text-center p-4 bg-background-light rounded-lg">
              <div className="w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                2
              </div>
              <h3 className="font-medium mb-1">Customer Creates DRID</h3>
              <p className="text-sm text-text-secondary">
                Go to /deposit and create a deposit slip with DRID
              </p>
            </div>
            <div className="text-center p-4 bg-background-light rounded-lg">
              <div className="w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                3
              </div>
              <h3 className="font-medium mb-1">Teller Retrieves</h3>
              <p className="text-sm text-text-secondary">
                Login as teller, use DRID Lookup to retrieve details
              </p>
            </div>
            <div className="text-center p-4 bg-background-light rounded-lg">
              <div className="w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                4
              </div>
              <h3 className="font-medium mb-1">Complete Transaction</h3>
              <p className="text-sm text-text-secondary">
                Verify, authorize, and complete - receipt generated!
              </p>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 pb-8 text-gray-400 text-sm">
          <p>Meezan Bank - Precision Receipt System</p>
          <p className="mt-1">Demo Setup Page</p>
        </div>
      </div>
    </div>
  );
};

export default DemoSetup;
