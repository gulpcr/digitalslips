/**
 * Customer Deposit Initiation Page
 * Pre-Branch digital deposit slip creation with dynamic transaction types
 */

import React, { useState } from 'react';
import { FiCheck, FiClock, FiAlertCircle, FiCopy, FiDownload, FiDollarSign, FiFileText, FiCreditCard, FiZap, FiSend, FiCamera, FiX } from 'react-icons/fi';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import { depositSlipService, DepositSlipCreateResponse } from '../services/depositSlip.service';
import ChequeScannerModal from '../components/ChequeScannerModal';
import { ChequeData } from '../services/chequeOcr.service';

// Transaction types with icons and labels
const TRANSACTION_TYPES = [
  { value: 'CASH_DEPOSIT', label: 'Cash Deposit', icon: FiDollarSign, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  { value: 'CHEQUE_DEPOSIT', label: 'Cheque Deposit', icon: FiFileText, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  { value: 'PAY_ORDER', label: 'Pay Order', icon: FiCreditCard, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  { value: 'BILL_PAYMENT', label: 'Bill Payment', icon: FiZap, color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  { value: 'FUND_TRANSFER', label: 'Fund Transfer', icon: FiSend, color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
];

// Bill types
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

// Pakistani banks
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

const CustomerDeposit: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DepositSlipCreateResponse | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showChequeScanner, setShowChequeScanner] = useState(false);

  // Form state
  const [transactionType, setTransactionType] = useState('CASH_DEPOSIT');
  const [customerCnic, setCustomerCnic] = useState('');
  const [customerAccount, setCustomerAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');

  // Depositor fields
  const [depositorRelationship, setDepositorRelationship] = useState('SELF');
  const [depositorName, setDepositorName] = useState('');
  const [depositorCnic, setDepositorCnic] = useState('');
  const [depositorPhone, setDepositorPhone] = useState('');

  // Business/Merchant fields
  const [businessName, setBusinessName] = useState('');
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [businessTaxId, setBusinessTaxId] = useState('');
  const [businessContactPerson, setBusinessContactPerson] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');

  // Cheque fields
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [chequeBank, setChequeBank] = useState('');
  const [chequeBranch, setChequeBranch] = useState('');
  const [chequeClearingType, setChequeClearingType] = useState('LOCAL'); // LOCAL or INTER_CITY
  const [chequePayeeName, setChequePayeeName] = useState('');
  const [chequeAccountHolderName, setChequeAccountHolderName] = useState('');
  const [chequeAmountInWords, setChequeAmountInWords] = useState('');
  const [chequeSignatureStatus, setChequeSignatureStatus] = useState('');
  const [chequeImageBase64, setChequeImageBase64] = useState<string | null>(null);

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

  // Customer lookup is disabled for public page - users enter details manually
  // The backend will validate CNIC and account when creating the deposit slip

  // Handle cheque scan completion - populate form fields
  const handleChequeScanComplete = (data: ChequeData) => {
    if (data.cheque_number) setChequeNumber(data.cheque_number);
    if (data.cheque_date) setChequeDate(data.cheque_date);
    if (data.bank_name) setChequeBank(data.bank_name);
    if (data.branch_name) setChequeBranch(data.branch_name);
    if (data.amount_in_figures) setAmount(data.amount_in_figures.toString());
    if (data.payee_name) setChequePayeeName(data.payee_name);
    if (data.account_holder_name) setChequeAccountHolderName(data.account_holder_name);
    if (data.amount_in_words) setChequeAmountInWords(data.amount_in_words);
    if (data.signature_status) setChequeSignatureStatus(data.signature_status);
    if (data.cheque_image_base64) setChequeImageBase64(data.cheque_image_base64);

    // Clear any existing errors for auto-filled fields
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.chequeNumber;
      delete newErrors.chequeDate;
      delete newErrors.chequeBank;
      delete newErrors.amount;
      delete newErrors.chequePayeeName;
      delete newErrors.chequeAccountHolderName;
      return newErrors;
    });

    toast.success(`Cheque details extracted (${Math.round((data.confidence_score || 0) * 100)}% confidence)`);
  };

  // Helper function to calculate clearing days and date
  const getClearingInfo = () => {
    const clearingDays = chequeClearingType === 'LOCAL' ? 1 : 3;
    const clearingDate = new Date();
    clearingDate.setDate(clearingDate.getDate() + clearingDays);

    return {
      days: clearingDays,
      date: clearingDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      fee: chequeClearingType === 'LOCAL' ? 50 : 150, // PKR
    };
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!customerCnic) newErrors.customerCnic = 'CNIC is required';
    else if (!customerCnic.match(/^\d{5}-\d{7}-\d{1}$/)) {
      newErrors.customerCnic = 'CNIC format: XXXXX-XXXXXXX-X';
    }

    if (!customerAccount) newErrors.customerAccount = 'Account number is required';
    if (!amount || parseFloat(amount) <= 0) newErrors.amount = 'Valid amount is required';

    // Type-specific validation
    if (transactionType === 'CASH_DEPOSIT') {
      if (depositorRelationship === 'BUSINESS') {
        if (!businessName) newErrors.businessName = 'Business name is required';
        if (!businessRegistrationNumber) newErrors.businessRegistrationNumber = 'Registration number is required';
        if (!businessTaxId) newErrors.businessTaxId = 'Tax ID/NTN is required';
        if (!businessContactPerson) newErrors.businessContactPerson = 'Contact person is required';
        if (!businessPhone) newErrors.businessPhone = 'Business phone is required';
      } else if (depositorRelationship !== 'SELF') {
        if (!depositorName) newErrors.depositorName = 'Depositor name is required';
        if (!depositorCnic) newErrors.depositorCnic = 'Depositor CNIC is required';
        if (!depositorPhone) newErrors.depositorPhone = 'Depositor phone is required';
      }
    }

    if (transactionType === 'CHEQUE_DEPOSIT') {
      if (!chequeNumber) newErrors.chequeNumber = 'Cheque number is required';
      else if (!chequeNumber.match(/^\d{6,10}$/)) newErrors.chequeNumber = '6-10 digits required';
      if (!chequeDate) newErrors.chequeDate = 'Cheque date is required';
      if (!chequeBank) newErrors.chequeBank = 'Cheque bank is required';
      if (!chequePayeeName) newErrors.chequePayeeName = 'Payee name is required';
    }

    if (transactionType === 'PAY_ORDER') {
      if (!payeeName) newErrors.payeeName = 'Payee name is required';
      if (!payeeCnic) newErrors.payeeCnic = 'Payee CNIC is required';
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
        newErrors.beneficiaryAccount = 'Cannot transfer to same account';
      }
      if (beneficiaryBank && beneficiaryBank !== 'Meezan Bank' && !beneficiaryIban) {
        newErrors.beneficiaryIban = 'IBAN required for inter-bank transfers';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      // Build additional data based on transaction type
      let additionalData: Record<string, any> | undefined;

      if (transactionType === 'CASH_DEPOSIT' && depositorRelationship === 'BUSINESS') {
        additionalData = {
          business_name: businessName,
          business_registration_number: businessRegistrationNumber,
          business_tax_id: businessTaxId,
          business_contact_person: businessContactPerson,
          business_phone: businessPhone,
        };
      } else if (transactionType === 'CHEQUE_DEPOSIT') {
        const clearingInfo = getClearingInfo();
        additionalData = {
          cheque_number: chequeNumber,
          cheque_date: chequeDate,
          cheque_bank: chequeBank,
          cheque_branch: chequeBranch || undefined,
          cheque_clearing_type: chequeClearingType,
          cheque_clearing_days: clearingInfo.days,
          cheque_processing_fee: clearingInfo.fee,
          cheque_payee_name: chequePayeeName,
          cheque_account_holder_name: chequeAccountHolderName || undefined,
          cheque_amount_in_words: chequeAmountInWords || undefined,
          cheque_signature_status: chequeSignatureStatus || undefined,
          cheque_image: chequeImageBase64 || undefined,
        };
      } else if (transactionType === 'PAY_ORDER') {
        additionalData = {
          payee_name: payeeName,
          payee_cnic: payeeCnic,
          payee_phone: payeePhone || undefined,
        };
      } else if (transactionType === 'BILL_PAYMENT') {
        additionalData = {
          bill_type: billType,
          consumer_number: consumerNumber,
          biller_name: billerName,
          due_date: dueDate || undefined,
        };
      } else if (transactionType === 'FUND_TRANSFER') {
        additionalData = {
          beneficiary_name: beneficiaryName,
          beneficiary_account: beneficiaryAccount,
          beneficiary_bank: beneficiaryBank,
          beneficiary_iban: beneficiaryIban || undefined,
          transfer_type: beneficiaryBank === 'Meezan Bank' ? 'INTERNAL' : 'INTER_BANK',
        };
      }

      const response = await depositSlipService.initiate({
        transaction_type: transactionType,
        customer_cnic: customerCnic,
        customer_account: customerAccount,
        amount: parseFloat(amount),
        currency: 'PKR',
        narration: narration || undefined,
        depositor_name: depositorName || undefined,
        depositor_cnic: depositorCnic || undefined,
        depositor_phone: depositorPhone || undefined,
        depositor_relationship: depositorRelationship,
        channel: 'WEB',
        additional_data: additionalData,
      });

      setResult(response);
      toast.success('Digital Deposit Slip created successfully!');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const message = err.response?.data?.detail || 'Failed to create deposit slip';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('DRID copied to clipboard!');
  };

  const renderFieldError = (field: string) => {
    if (errors[field]) {
      return (
        <p className="text-sm text-error mt-1 flex items-center gap-1">
          <FiAlertCircle className="w-3 h-3" />
          {errors[field]}
        </p>
      );
    }
    return null;
  };

  const getSelectedTypeConfig = () => {
    return TRANSACTION_TYPES.find(t => t.value === transactionType);
  };

  // Show result page after successful creation
  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-700 to-primary flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success rounded-full mb-4">
              <FiCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Deposit Slip Created!</h1>
            <p className="text-gray-300 mt-2">Your digital reference is ready</p>
          </div>

          <Card padding="lg" shadow="lg">
            <div className="text-center">
              <p className="text-sm text-text-secondary mb-2">Your Digital Reference ID (DRID)</p>
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-3xl font-bold text-primary tracking-wider">
                  {result.drid}
                </span>
                <button
                  onClick={() => copyToClipboard(result.drid)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <FiCopy className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-warning mb-6">
                <FiClock className="w-5 h-5" />
                <span className="font-medium">Valid for {result.validity_minutes} minutes</span>
              </div>

              {result.qr_code_data && (
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-white rounded-lg border border-border">
                    <img src={result.qr_code_data} alt="DRID QR Code" className="w-48 h-48" />
                    <p className="text-xs text-text-secondary text-center mt-2">Show this at bank counter</p>
                  </div>
                </div>
              )}

              <div className="bg-background-light p-4 rounded-lg text-left mb-6">
                <h3 className="font-semibold text-text-primary mb-2">Next Steps:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary">
                  <li>Note down or save your DRID: <strong>{result.drid}</strong></li>
                  <li>Visit any Meezan Bank branch within {result.validity_minutes} minutes</li>
                  <li>Provide this DRID to the teller</li>
                  <li>The teller will retrieve your details automatically</li>
                  <li>Complete verification and receive your receipt</li>
                </ol>
              </div>

              <div className="flex items-start gap-3 p-4 bg-warning-50 border border-warning rounded-lg text-left">
                <FiAlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-warning">Important</p>
                  <p className="text-text-secondary">
                    This DRID expires at {new Date(result.expires_at).toLocaleTimeString()}.
                    After expiry, you will need to create a new deposit slip.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" fullWidth onClick={() => setResult(null)}>
                  Create Another
                </Button>
                <Button variant="primary" fullWidth onClick={() => window.print()} leftIcon={<FiDownload />}>
                  Print/Save
                </Button>
              </div>
            </div>
          </Card>

          <div className="text-center mt-8 text-gray-400 text-sm">
            <p>Meezan Bank - Digital Transaction System</p>
          </div>
        </div>
      </div>
    );
  }

  const typeConfig = getSelectedTypeConfig();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 to-primary py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/assets/meezan-logo.png" alt="Meezan Bank" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">Digital Deposit Slip</h1>
          <p className="text-gray-300 mt-2">Create your deposit slip online before visiting the branch</p>
        </div>

        {/* Form Card */}
        <Card padding="lg" shadow="lg">
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
                          : 'border-border hover:border-primary-200 bg-white'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isSelected ? 'text-primary' : type.color}`} />
                      <span className={`text-xs font-medium text-center ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                        {type.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
                Your Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Your CNIC *"
                    placeholder="42101-1234567-1"
                    value={customerCnic}
                    onChange={(e) => setCustomerCnic(e.target.value)}
                    fullWidth
                    error={!!errors.customerCnic}
                  />
                  {renderFieldError('customerCnic')}
                </div>
                <div>
                  <Input
                    label="Account Number *"
                    placeholder="0101234567890"
                    value={customerAccount}
                    onChange={(e) => setCustomerAccount(e.target.value)}
                    fullWidth
                    error={!!errors.customerAccount}
                  />
                  {renderFieldError('customerAccount')}
                </div>
              </div>

              <div>
                <Input
                  label="Amount (PKR) *"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  fullWidth
                  error={!!errors.amount}
                />
                {renderFieldError('amount')}
              </div>
            </div>

            {/* Type-Specific Fields */}
            {transactionType === 'CASH_DEPOSIT' && (
              <div className={`space-y-4 mb-6 p-4 rounded-lg border ${typeConfig?.bgColor} ${typeConfig?.borderColor}`}>
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <FiDollarSign className="text-green-600" />
                  Depositor Information
                </h3>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Who will deposit?</label>
                  <select
                    className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    value={depositorRelationship}
                    onChange={(e) => setDepositorRelationship(e.target.value)}
                  >
                    <option value="SELF">Myself</option>
                    <option value="FAMILY">Family Member</option>
                    <option value="AGENT">Authorized Agent</option>
                    <option value="BUSINESS">Business / Merchant</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {depositorRelationship === 'BUSINESS' ? (
                  <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <FiFileText className="text-blue-600" />
                      Business Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Input label="Business Name *" placeholder="ABC Corporation" value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)} fullWidth error={!!errors.businessName} />
                        {renderFieldError('businessName')}
                      </div>
                      <div>
                        <Input label="Registration Number *" placeholder="REG-123456" value={businessRegistrationNumber}
                          onChange={(e) => setBusinessRegistrationNumber(e.target.value)} fullWidth error={!!errors.businessRegistrationNumber} />
                        {renderFieldError('businessRegistrationNumber')}
                      </div>
                      <div>
                        <Input label="Tax ID / NTN *" placeholder="1234567-8" value={businessTaxId}
                          onChange={(e) => setBusinessTaxId(e.target.value)} fullWidth error={!!errors.businessTaxId} />
                        {renderFieldError('businessTaxId')}
                      </div>
                      <div>
                        <Input label="Contact Person *" placeholder="Full name" value={businessContactPerson}
                          onChange={(e) => setBusinessContactPerson(e.target.value)} fullWidth error={!!errors.businessContactPerson} />
                        {renderFieldError('businessContactPerson')}
                      </div>
                      <div className="md:col-span-2">
                        <Input label="Business Phone *" placeholder="+92-21-1234567" value={businessPhone}
                          onChange={(e) => setBusinessPhone(e.target.value)} fullWidth error={!!errors.businessPhone} />
                        {renderFieldError('businessPhone')}
                      </div>
                    </div>
                  </div>
                ) : depositorRelationship !== 'SELF' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Input label="Depositor Name *" placeholder="Full name" value={depositorName}
                        onChange={(e) => setDepositorName(e.target.value)} fullWidth error={!!errors.depositorName} />
                      {renderFieldError('depositorName')}
                    </div>
                    <div>
                      <Input label="Depositor CNIC *" placeholder="42101-1234567-1" value={depositorCnic}
                        onChange={(e) => setDepositorCnic(e.target.value)} fullWidth error={!!errors.depositorCnic} />
                      {renderFieldError('depositorCnic')}
                    </div>
                    <div>
                      <Input label="Depositor Phone *" placeholder="+92-300-1234567" value={depositorPhone}
                        onChange={(e) => setDepositorPhone(e.target.value)} fullWidth error={!!errors.depositorPhone} />
                      {renderFieldError('depositorPhone')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {transactionType === 'CHEQUE_DEPOSIT' && (
              <div className={`space-y-4 mb-6 p-4 rounded-lg border ${typeConfig?.bgColor} ${typeConfig?.borderColor}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                    <FiFileText className="text-blue-600" />
                    Cheque Details
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    leftIcon={<FiCamera />}
                    onClick={() => setShowChequeScanner(true)}
                  >
                    Scan Cheque
                  </Button>
                </div>

                {/* Cheque Image Preview */}
                {chequeImageBase64 && (
                  <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={chequeImageBase64}
                      alt="Scanned cheque"
                      className="w-full h-40 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setChequeImageBase64(null)}
                      className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-gray-100"
                    >
                      <FiX className="w-4 h-4 text-text-secondary" />
                    </button>
                  </div>
                )}

                {/* Clearing Type Selection */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="block text-sm font-medium text-text-primary mb-2">Cheque Clearing Type *</label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="clearingType"
                        value="LOCAL"
                        checked={chequeClearingType === 'LOCAL'}
                        onChange={(e) => setChequeClearingType(e.target.value)}
                        className="w-4 h-4 text-primary"
                      />
                      <span className="text-sm font-medium">Local Cheque</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="clearingType"
                        value="INTER_CITY"
                        checked={chequeClearingType === 'INTER_CITY'}
                        onChange={(e) => setChequeClearingType(e.target.value)}
                        className="w-4 h-4 text-primary"
                      />
                      <span className="text-sm font-medium">Inter-City Cheque</span>
                    </label>
                  </div>
                  <div className="text-sm text-text-secondary bg-white p-3 rounded border border-blue-100">
                    <div className="flex items-center justify-between mb-1">
                      <span>Clearing Time:</span>
                      <span className="font-semibold text-primary">{getClearingInfo().days} {getClearingInfo().days === 1 ? 'day' : 'days'}</span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span>Expected Clearance:</span>
                      <span className="font-semibold text-primary">{getClearingInfo().date}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Processing Fee:</span>
                      <span className="font-semibold text-primary">PKR {getClearingInfo().fee}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Bank Name *</label>
                    <select className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                      value={chequeBank} onChange={(e) => setChequeBank(e.target.value)}>
                      <option value="">Select bank</option>
                      {BANKS.map((bank) => (<option key={bank} value={bank}>{bank}</option>))}
                    </select>
                    {renderFieldError('chequeBank')}
                  </div>
                  <div>
                    <Input label="Cheque Date *" type="date" value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)} fullWidth error={!!errors.chequeDate} />
                    {renderFieldError('chequeDate')}
                  </div>
                  <div>
                    <Input label="Account Holder Name" placeholder="Cheque owner name (from cheque)" value={chequeAccountHolderName}
                      onChange={(e) => setChequeAccountHolderName(e.target.value)} fullWidth />
                    <p className="text-xs text-text-secondary mt-1">Name printed on the cheque</p>
                  </div>
                  <div>
                    <Input label="Payee Name *" placeholder="Pay to (recipient)" value={chequePayeeName}
                      onChange={(e) => setChequePayeeName(e.target.value)} fullWidth error={!!errors.chequePayeeName} />
                    {renderFieldError('chequePayeeName')}
                  </div>
                  <div>
                    <Input label="Cheque Number *" placeholder="123456" value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value.replace(/\D/g, ''))} fullWidth error={!!errors.chequeNumber} />
                    <p className="text-xs text-text-secondary mt-1">6-10 digits</p>
                    {renderFieldError('chequeNumber')}
                  </div>
                </div>

                <div>
                  <Input label="Amount in Words" placeholder="e.g., Fifty Thousand Rupees Only" value={chequeAmountInWords}
                    onChange={(e) => setChequeAmountInWords(e.target.value)} fullWidth />
                  <p className="text-xs text-text-secondary mt-1">As written on the cheque</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input label="Branch Name" placeholder="Branch name (optional)" value={chequeBranch}
                      onChange={(e) => setChequeBranch(e.target.value)} fullWidth />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Signature Status</label>
                    <select className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                      value={chequeSignatureStatus} onChange={(e) => setChequeSignatureStatus(e.target.value)}>
                      <option value="">Not verified</option>
                      <option value="present">Signature Present</option>
                      <option value="missing">Signature Missing</option>
                      <option value="unclear">Unclear</option>
                    </select>
                    {chequeSignatureStatus === 'missing' && (
                      <p className="text-xs text-red-500 mt-1">Warning: Cheque may be rejected without signature</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {transactionType === 'PAY_ORDER' && (
              <div className={`space-y-4 mb-6 p-4 rounded-lg border ${typeConfig?.bgColor} ${typeConfig?.borderColor}`}>
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <FiCreditCard className="text-purple-600" />
                  Payee Information
                </h3>
                <p className="text-sm text-text-secondary">Person receiving the pay order</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Input label="Payee Name *" placeholder="Full name" value={payeeName}
                      onChange={(e) => setPayeeName(e.target.value)} fullWidth error={!!errors.payeeName} />
                    {renderFieldError('payeeName')}
                  </div>
                  <div>
                    <Input label="Payee CNIC *" placeholder="42101-1234567-1" value={payeeCnic}
                      onChange={(e) => setPayeeCnic(e.target.value)} fullWidth error={!!errors.payeeCnic} />
                    {renderFieldError('payeeCnic')}
                  </div>
                  <div>
                    <Input label="Payee Phone" placeholder="+92-300-1234567" value={payeePhone}
                      onChange={(e) => setPayeePhone(e.target.value)} fullWidth />
                  </div>
                </div>
              </div>
            )}

            {transactionType === 'BILL_PAYMENT' && (
              <div className={`space-y-4 mb-6 p-4 rounded-lg border ${typeConfig?.bgColor} ${typeConfig?.borderColor}`}>
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <FiZap className="text-yellow-600" />
                  Bill Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Bill Type *</label>
                    <select className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                      value={billType} onChange={(e) => setBillType(e.target.value)}>
                      <option value="">Select bill type</option>
                      {BILL_TYPES.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                    </select>
                    {renderFieldError('billType')}
                  </div>
                  <div>
                    <Input label="Consumer Number *" placeholder="12-345-6789012-3" value={consumerNumber}
                      onChange={(e) => setConsumerNumber(e.target.value)} fullWidth error={!!errors.consumerNumber} />
                    {renderFieldError('consumerNumber')}
                  </div>
                  <div>
                    <Input label="Biller Name *" placeholder="e.g., K-Electric, SNGPL" value={billerName}
                      onChange={(e) => setBillerName(e.target.value)} fullWidth error={!!errors.billerName} />
                    {renderFieldError('billerName')}
                  </div>
                  <div>
                    <Input label="Due Date" type="date" value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)} fullWidth />
                  </div>
                </div>
              </div>
            )}

            {transactionType === 'FUND_TRANSFER' && (
              <div className={`space-y-4 mb-6 p-4 rounded-lg border ${typeConfig?.bgColor} ${typeConfig?.borderColor}`}>
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <FiSend className="text-cyan-600" />
                  Beneficiary Information
                </h3>
                <p className="text-sm text-text-secondary">Person receiving the funds</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input label="Beneficiary Name *" placeholder="Full name" value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)} fullWidth error={!!errors.beneficiaryName} />
                    {renderFieldError('beneficiaryName')}
                  </div>
                  <div>
                    <Input label="Beneficiary Account *" placeholder="0201234567891" value={beneficiaryAccount}
                      onChange={(e) => setBeneficiaryAccount(e.target.value)} fullWidth error={!!errors.beneficiaryAccount} />
                    {renderFieldError('beneficiaryAccount')}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Beneficiary Bank *</label>
                    <select className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                      value={beneficiaryBank} onChange={(e) => setBeneficiaryBank(e.target.value)}>
                      <option value="">Select bank</option>
                      {BANKS.map((bank) => (<option key={bank} value={bank}>{bank}</option>))}
                    </select>
                    {renderFieldError('beneficiaryBank')}
                  </div>
                  <div>
                    <Input label={`IBAN ${beneficiaryBank && beneficiaryBank !== 'Meezan Bank' ? '*' : ''}`}
                      placeholder="PK36MEZN0001234567891234" value={beneficiaryIban}
                      onChange={(e) => setBeneficiaryIban(e.target.value.toUpperCase())} fullWidth error={!!errors.beneficiaryIban} />
                    <p className="text-xs text-text-secondary mt-1">
                      {beneficiaryBank && beneficiaryBank !== 'Meezan Bank' ? 'Required for inter-bank' : 'Optional for Meezan Bank'}
                    </p>
                    {renderFieldError('beneficiaryIban')}
                  </div>
                </div>
              </div>
            )}

            {/* Narration */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-text-primary mb-1">Narration (Optional)</label>
              <textarea
                className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary resize-y min-h-[80px]"
                placeholder="Purpose of transaction"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
              />
            </div>

            {/* Info Box */}
            <div className="flex items-start gap-3 p-4 bg-accent-50 border border-accent rounded-lg mb-6">
              <FiClock className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-accent">Time-Bound Reference</p>
                <p className="text-text-secondary">
                  Your DRID will be valid for 60 minutes. Please visit a Meezan Bank branch within this time.
                </p>
              </div>
            </div>

            {/* Submit */}
            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Generate Digital Reference (DRID)
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-400 text-sm">
          <p>Meezan Bank Pakistan - Digital Transaction System</p>
          <p className="mt-1">Powered by <span className="text-accent">eDimensionz</span></p>
        </div>
      </div>

      {/* Cheque Scanner Modal */}
      <ChequeScannerModal
        isOpen={showChequeScanner}
        onClose={() => setShowChequeScanner(false)}
        onScanComplete={handleChequeScanComplete}
      />
    </div>
  );
};

export default CustomerDeposit;
