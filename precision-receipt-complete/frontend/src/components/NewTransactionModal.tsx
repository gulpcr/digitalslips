/**
 * New Transaction Modal
 * Dynamic form with type-specific fields
 */

import React, { useState, useEffect } from 'react';
import { FiX, FiDollarSign, FiFileText, FiCreditCard, FiZap, FiSend, FiAlertCircle } from 'react-icons/fi';
import Button from './ui/Button';
import Card from './ui/Card';
import Input from './ui/Input';
import toast from 'react-hot-toast';
import { transactionService } from '../services/transaction.service';
import { TransactionCreate } from '../types';
import api from '../services/api';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Transaction types with icons and labels
const TRANSACTION_TYPES = [
  { value: 'CASH_DEPOSIT', label: 'Cash Deposit', icon: FiDollarSign, color: 'text-green-600' },
  { value: 'CHEQUE_DEPOSIT', label: 'Cheque Deposit', icon: FiFileText, color: 'text-blue-600' },
  { value: 'PAY_ORDER', label: 'Pay Order', icon: FiCreditCard, color: 'text-purple-600' },
  { value: 'BILL_PAYMENT', label: 'Bill Payment', icon: FiZap, color: 'text-yellow-600' },
  { value: 'FUND_TRANSFER', label: 'Fund Transfer', icon: FiSend, color: 'text-cyan-600' },
];

// Bill types for bill payment
const BILL_TYPES = [
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'GAS', label: 'Gas' },
  { value: 'WATER', label: 'Water' },
  { value: 'PHONE', label: 'Phone/Mobile' },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'CARD', label: 'Credit Card' },
  { value: 'LOAN', label: 'Loan Payment' },
  { value: 'GOVERNMENT', label: 'Government Fee/Tax' },
  { value: 'OTHER', label: 'Other' },
];

// Pakistani banks list
const BANKS = [
  'Meezan Bank',
  'Allied Bank Limited',
  'Askari Bank',
  'Bank Alfalah',
  'Bank Al-Habib',
  'Faysal Bank',
  'Habib Bank Limited',
  'JS Bank',
  'MCB Bank',
  'National Bank of Pakistan',
  'Standard Chartered Bank',
  'United Bank Limited',
  'Other',
];

interface FormErrors {
  [key: string]: string;
}

interface CustomerAccount {
  account_number: string;
  account_title: string;
  balance: string;
}

interface CustomerInfo {
  id: string;
  cnic: string;
  full_name: string;
  phone: string;
  accounts: CustomerAccount[];
}

const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // Form state
  const [transactionType, setTransactionType] = useState('CASH_DEPOSIT');
  const [customerCnic, setCustomerCnic] = useState('');
  const [customerAccount, setCustomerAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [currency] = useState('PKR');
  const [narration, setNarration] = useState('');

  // Depositor fields (Cash Deposit, Cheque Deposit optional)
  const [depositorName, setDepositorName] = useState('');
  const [depositorCnic, setDepositorCnic] = useState('');
  const [depositorPhone, setDepositorPhone] = useState('');

  // Cheque fields
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [chequeBank, setChequeBank] = useState('');
  const [chequeBranch, setChequeBranch] = useState('');

  // Pay Order fields
  const [payeeName, setPayeeName] = useState('');
  const [payeeCnic, setPayeeCnic] = useState('');
  const [payeePhone, setPayeePhone] = useState('');

  // Bill Payment fields
  const [billType, setBillType] = useState('');
  const [consumerNumber, setConsumerNumber] = useState('');
  const [billerName, setBillerName] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Fund Transfer fields
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('');
  const [beneficiaryBank, setBeneficiaryBank] = useState('');
  const [beneficiaryIban, setBeneficiaryIban] = useState('');

  // Fetch customer info when CNIC changes
  useEffect(() => {
    const fetchCustomer = async () => {
      if (customerCnic.length === 15 && customerCnic.match(/^\d{5}-\d{7}-\d{1}$/)) {
        setLoadingCustomer(true);
        try {
          const response = await api.get(`/customers/by-cnic/${customerCnic}`);
          if (response.data) {
            setCustomerInfo(response.data);
            // Auto-select first account if available
            if (response.data.accounts && response.data.accounts.length > 0) {
              setCustomerAccount(response.data.accounts[0].account_number);
            }
          }
        } catch {
          setCustomerInfo(null);
        } finally {
          setLoadingCustomer(false);
        }
      } else {
        setCustomerInfo(null);
      }
    };

    fetchCustomer();
  }, [customerCnic]);

  const resetForm = () => {
    setTransactionType('CASH_DEPOSIT');
    setCustomerCnic('');
    setCustomerAccount('');
    setAmount('');
    setNarration('');
    setDepositorName('');
    setDepositorCnic('');
    setDepositorPhone('');
    setChequeNumber('');
    setChequeDate('');
    setChequeBank('');
    setChequeBranch('');
    setPayeeName('');
    setPayeeCnic('');
    setPayeePhone('');
    setBillType('');
    setConsumerNumber('');
    setBillerName('');
    setDueDate('');
    setBeneficiaryName('');
    setBeneficiaryAccount('');
    setBeneficiaryBank('');
    setBeneficiaryIban('');
    setErrors({});
    setCustomerInfo(null);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Common validation
    if (!customerCnic) newErrors.customerCnic = 'Customer CNIC is required';
    else if (!customerCnic.match(/^\d{5}-\d{7}-\d{1}$/)) {
      newErrors.customerCnic = 'CNIC must be in format: XXXXX-XXXXXXX-X';
    }

    if (!customerAccount) newErrors.customerAccount = 'Account number is required';

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    // Type-specific validation
    if (transactionType === 'CASH_DEPOSIT') {
      if (!depositorName) newErrors.depositorName = 'Depositor name is required';
      if (!depositorCnic) newErrors.depositorCnic = 'Depositor CNIC is required';
      else if (!depositorCnic.match(/^\d{5}-\d{7}-\d{1}$/)) {
        newErrors.depositorCnic = 'CNIC must be in format: XXXXX-XXXXXXX-X';
      }
      if (!depositorPhone) newErrors.depositorPhone = 'Depositor phone is required';
    }

    if (transactionType === 'CHEQUE_DEPOSIT') {
      if (!chequeNumber) newErrors.chequeNumber = 'Cheque number is required';
      else if (!chequeNumber.match(/^\d{6,10}$/)) {
        newErrors.chequeNumber = 'Cheque number must be 6-10 digits';
      }
      if (!chequeDate) newErrors.chequeDate = 'Cheque date is required';
      else {
        const chequeDateObj = new Date(chequeDate);
        const today = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        if (chequeDateObj > today) {
          newErrors.chequeDate = 'Cheque date cannot be in the future';
        } else if (chequeDateObj < sixMonthsAgo) {
          newErrors.chequeDate = 'Cheque cannot be older than 6 months';
        }
      }
      if (!chequeBank) newErrors.chequeBank = 'Cheque bank is required';
    }

    if (transactionType === 'PAY_ORDER') {
      if (!payeeName) newErrors.payeeName = 'Payee name is required';
      if (!payeeCnic) newErrors.payeeCnic = 'Payee CNIC is required';
      else if (!payeeCnic.match(/^\d{5}-\d{7}-\d{1}$/)) {
        newErrors.payeeCnic = 'CNIC must be in format: XXXXX-XXXXXXX-X';
      }
    }

    if (transactionType === 'BILL_PAYMENT') {
      if (!billType) newErrors.billType = 'Bill type is required';
      if (!consumerNumber) newErrors.consumerNumber = 'Consumer number is required';
      if (!billerName) newErrors.billerName = 'Biller name is required';
    }

    if (transactionType === 'FUND_TRANSFER') {
      if (!beneficiaryName) newErrors.beneficiaryName = 'Beneficiary name is required';
      if (!beneficiaryAccount) newErrors.beneficiaryAccount = 'Beneficiary account is required';
      if (!beneficiaryBank) newErrors.beneficiaryBank = 'Beneficiary bank is required';
      if (beneficiaryAccount === customerAccount) {
        newErrors.beneficiaryAccount = 'Cannot transfer to the same account';
      }
      if (beneficiaryBank && beneficiaryBank !== 'Meezan Bank' && !beneficiaryIban) {
        newErrors.beneficiaryIban = 'IBAN is required for inter-bank transfers';
      }
      if (beneficiaryIban && !beneficiaryIban.match(/^PK\d{2}[A-Z]{4}\d{16}$/)) {
        newErrors.beneficiaryIban = 'IBAN must be in format: PK + 2 digits + 4 letters + 16 digits';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildAdditionalData = (): Record<string, any> | undefined => {
    switch (transactionType) {
      case 'CHEQUE_DEPOSIT':
        return {
          cheque_number: chequeNumber,
          cheque_date: chequeDate,
          cheque_bank: chequeBank,
          cheque_branch: chequeBranch || undefined,
        };
      case 'PAY_ORDER':
        return {
          payee_name: payeeName,
          payee_cnic: payeeCnic,
          payee_phone: payeePhone || undefined,
        };
      case 'BILL_PAYMENT':
        return {
          bill_type: billType,
          consumer_number: consumerNumber,
          biller_name: billerName,
          due_date: dueDate || undefined,
        };
      case 'FUND_TRANSFER':
        return {
          beneficiary_name: beneficiaryName,
          beneficiary_account: beneficiaryAccount,
          beneficiary_bank: beneficiaryBank,
          beneficiary_iban: beneficiaryIban || undefined,
          transfer_type: beneficiaryBank === 'Meezan Bank' ? 'INTERNAL' : 'INTER_BANK',
        };
      default:
        return undefined;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      const formData: TransactionCreate = {
        transaction_type: transactionType,
        customer_cnic: customerCnic,
        customer_account: customerAccount,
        amount: parseFloat(amount),
        currency,
        narration: narration || undefined,
        depositor_name: depositorName || undefined,
        depositor_cnic: depositorCnic || undefined,
        depositor_phone: depositorPhone || undefined,
        additional_data: buildAdditionalData(),
      };

      await transactionService.createTransaction(formData);
      toast.success('Transaction created successfully!');
      onSuccess();
      onClose();
      resetForm();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const message = err.response?.data?.detail || 'Failed to create transaction';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const renderFieldError = (field: string) => {
    if (errors[field]) {
      return (
        <p className="text-sm text-error mt-1 flex items-center gap-1">
          <FiAlertCircle className="w-4 h-4" />
          {errors[field]}
        </p>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <Card padding="lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-primary">New Transaction</h2>
            <button
              onClick={handleClose}
              className="text-text-secondary hover:text-text-primary"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Transaction Type Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-text-primary mb-3">
                Select Transaction Type *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {TRANSACTION_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = transactionType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setTransactionType(type.value)}
                      className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                        isSelected
                          ? 'border-primary bg-primary-50'
                          : 'border-border hover:border-primary-light'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isSelected ? 'text-primary' : type.color}`} />
                      <span className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                        {type.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Common Fields */}
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
                Customer Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer CNIC */}
                <div>
                  <Input
                    label="Customer CNIC *"
                    placeholder="42101-1234567-1"
                    value={customerCnic}
                    onChange={(e) => setCustomerCnic(e.target.value)}
                    fullWidth
                    error={!!errors.customerCnic}
                  />
                  {renderFieldError('customerCnic')}
                  {loadingCustomer && (
                    <p className="text-sm text-text-secondary mt-1">Loading customer info...</p>
                  )}
                  {customerInfo && (
                    <p className="text-sm text-success mt-1">
                      Customer: {customerInfo.full_name}
                    </p>
                  )}
                </div>

                {/* Customer Account */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Account Number *
                  </label>
                  {customerInfo && customerInfo.accounts.length > 0 ? (
                    <select
                      className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary"
                      value={customerAccount}
                      onChange={(e) => setCustomerAccount(e.target.value)}
                    >
                      <option value="">Select account</option>
                      {customerInfo.accounts.map((acc) => (
                        <option key={acc.account_number} value={acc.account_number}>
                          {acc.account_number} - {acc.account_title} (PKR {parseFloat(acc.balance).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="0101234567890"
                      value={customerAccount}
                      onChange={(e) => setCustomerAccount(e.target.value)}
                      fullWidth
                      error={!!errors.customerAccount}
                    />
                  )}
                  {renderFieldError('customerAccount')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Amount */}
                <div>
                  <Input
                    label="Amount (PKR) *"
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    fullWidth
                    error={!!errors.amount}
                  />
                  {renderFieldError('amount')}
                </div>

                {/* Narration */}
                <div>
                  <Input
                    label="Narration"
                    placeholder="Transaction description (optional)"
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    fullWidth
                  />
                </div>
              </div>
            </div>

            {/* Type-Specific Fields */}
            {transactionType === 'CASH_DEPOSIT' && (
              <div className="space-y-4 mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <FiDollarSign className="text-green-600" />
                  Depositor Information
                </h3>
                <p className="text-sm text-text-secondary">Person depositing the cash</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Input
                      label="Depositor Name *"
                      placeholder="Full name"
                      value={depositorName}
                      onChange={(e) => setDepositorName(e.target.value)}
                      fullWidth
                      error={!!errors.depositorName}
                    />
                    {renderFieldError('depositorName')}
                  </div>
                  <div>
                    <Input
                      label="Depositor CNIC *"
                      placeholder="42101-1234567-1"
                      value={depositorCnic}
                      onChange={(e) => setDepositorCnic(e.target.value)}
                      fullWidth
                      error={!!errors.depositorCnic}
                    />
                    {renderFieldError('depositorCnic')}
                  </div>
                  <div>
                    <Input
                      label="Depositor Phone *"
                      placeholder="+92-300-1234567"
                      value={depositorPhone}
                      onChange={(e) => setDepositorPhone(e.target.value)}
                      fullWidth
                      error={!!errors.depositorPhone}
                    />
                    {renderFieldError('depositorPhone')}
                  </div>
                </div>
              </div>
            )}

            {transactionType === 'CHEQUE_DEPOSIT' && (
              <div className="space-y-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <FiFileText className="text-blue-600" />
                  Cheque Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="Cheque Number *"
                      placeholder="123456"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value.replace(/\D/g, ''))}
                      fullWidth
                      error={!!errors.chequeNumber}
                    />
                    <p className="text-xs text-text-secondary mt-1">6-10 digits</p>
                    {renderFieldError('chequeNumber')}
                  </div>
                  <div>
                    <Input
                      label="Cheque Date *"
                      type="date"
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                      fullWidth
                      error={!!errors.chequeDate}
                    />
                    {renderFieldError('chequeDate')}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Cheque Bank *
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary"
                      value={chequeBank}
                      onChange={(e) => setChequeBank(e.target.value)}
                    >
                      <option value="">Select bank</option>
                      {BANKS.map((bank) => (
                        <option key={bank} value={bank}>{bank}</option>
                      ))}
                    </select>
                    {renderFieldError('chequeBank')}
                  </div>
                  <div>
                    <Input
                      label="Cheque Branch"
                      placeholder="Branch name (optional)"
                      value={chequeBranch}
                      onChange={(e) => setChequeBranch(e.target.value)}
                      fullWidth
                    />
                  </div>
                </div>

                {/* Optional depositor info for cheque */}
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <h4 className="text-sm font-medium text-text-primary mb-3">Depositor Information (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Depositor Name"
                      placeholder="Full name"
                      value={depositorName}
                      onChange={(e) => setDepositorName(e.target.value)}
                      fullWidth
                    />
                    <Input
                      label="Depositor CNIC"
                      placeholder="42101-1234567-1"
                      value={depositorCnic}
                      onChange={(e) => setDepositorCnic(e.target.value)}
                      fullWidth
                    />
                    <Input
                      label="Depositor Phone"
                      placeholder="+92-300-1234567"
                      value={depositorPhone}
                      onChange={(e) => setDepositorPhone(e.target.value)}
                      fullWidth
                    />
                  </div>
                </div>
              </div>
            )}

            {transactionType === 'PAY_ORDER' && (
              <div className="space-y-4 mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <FiCreditCard className="text-purple-600" />
                  Payee Information
                </h3>
                <p className="text-sm text-text-secondary">Person receiving the pay order</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Input
                      label="Payee Name *"
                      placeholder="Full name"
                      value={payeeName}
                      onChange={(e) => setPayeeName(e.target.value)}
                      fullWidth
                      error={!!errors.payeeName}
                    />
                    {renderFieldError('payeeName')}
                  </div>
                  <div>
                    <Input
                      label="Payee CNIC *"
                      placeholder="42101-1234567-1"
                      value={payeeCnic}
                      onChange={(e) => setPayeeCnic(e.target.value)}
                      fullWidth
                      error={!!errors.payeeCnic}
                    />
                    {renderFieldError('payeeCnic')}
                  </div>
                  <div>
                    <Input
                      label="Payee Phone"
                      placeholder="+92-300-1234567"
                      value={payeePhone}
                      onChange={(e) => setPayeePhone(e.target.value)}
                      fullWidth
                    />
                  </div>
                </div>
              </div>
            )}

            {transactionType === 'BILL_PAYMENT' && (
              <div className="space-y-4 mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <FiZap className="text-yellow-600" />
                  Bill Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Bill Type *
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary"
                      value={billType}
                      onChange={(e) => setBillType(e.target.value)}
                    >
                      <option value="">Select bill type</option>
                      {BILL_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    {renderFieldError('billType')}
                  </div>
                  <div>
                    <Input
                      label="Consumer Number *"
                      placeholder="12-345-6789012-3"
                      value={consumerNumber}
                      onChange={(e) => setConsumerNumber(e.target.value)}
                      fullWidth
                      error={!!errors.consumerNumber}
                    />
                    {renderFieldError('consumerNumber')}
                  </div>
                  <div>
                    <Input
                      label="Biller Name *"
                      placeholder="e.g., K-Electric, SNGPL"
                      value={billerName}
                      onChange={(e) => setBillerName(e.target.value)}
                      fullWidth
                      error={!!errors.billerName}
                    />
                    {renderFieldError('billerName')}
                  </div>
                  <div>
                    <Input
                      label="Due Date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      fullWidth
                    />
                  </div>
                </div>
              </div>
            )}

            {transactionType === 'FUND_TRANSFER' && (
              <div className="space-y-4 mb-6 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <FiSend className="text-cyan-600" />
                  Beneficiary Information
                </h3>
                <p className="text-sm text-text-secondary">Person receiving the funds</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="Beneficiary Name *"
                      placeholder="Full name"
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      fullWidth
                      error={!!errors.beneficiaryName}
                    />
                    {renderFieldError('beneficiaryName')}
                  </div>
                  <div>
                    <Input
                      label="Beneficiary Account *"
                      placeholder="0201234567891"
                      value={beneficiaryAccount}
                      onChange={(e) => setBeneficiaryAccount(e.target.value)}
                      fullWidth
                      error={!!errors.beneficiaryAccount}
                    />
                    {renderFieldError('beneficiaryAccount')}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Beneficiary Bank *
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary"
                      value={beneficiaryBank}
                      onChange={(e) => setBeneficiaryBank(e.target.value)}
                    >
                      <option value="">Select bank</option>
                      {BANKS.map((bank) => (
                        <option key={bank} value={bank}>{bank}</option>
                      ))}
                    </select>
                    {renderFieldError('beneficiaryBank')}
                  </div>
                  <div>
                    <Input
                      label={`IBAN ${beneficiaryBank && beneficiaryBank !== 'Meezan Bank' ? '*' : ''}`}
                      placeholder="PK36MEZN0001234567891234"
                      value={beneficiaryIban}
                      onChange={(e) => setBeneficiaryIban(e.target.value.toUpperCase())}
                      fullWidth
                      error={!!errors.beneficiaryIban}
                    />
                    <p className="text-xs text-text-secondary mt-1">
                      {beneficiaryBank && beneficiaryBank !== 'Meezan Bank'
                        ? 'Required for inter-bank transfers'
                        : 'Optional for Meezan Bank transfers'}
                    </p>
                    {renderFieldError('beneficiaryIban')}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={loading}
              >
                Create Transaction
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default NewTransactionModal;
