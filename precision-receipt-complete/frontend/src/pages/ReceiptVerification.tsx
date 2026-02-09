/**
 * Receipt Verification Page
 * Public page for viewing and verifying transaction receipts
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  FiCheckCircle, FiXCircle, FiUser, FiCreditCard, FiCalendar,
  FiHash, FiFileText, FiShield
} from 'react-icons/fi';
import { BsBuilding, BsQrCode } from 'react-icons/bs';

interface ReceiptDetail {
  id: string;
  transaction_id: string;
  receipt_number: string;
  receipt_type: string;
  verification_url: string;
  verification_qr_data: string;
  is_verified: boolean;
  verified_count: number;
  last_verified_at: string | null;
  created_at: string;
  reference_number: string;
  transaction_type: string;
  customer_name: string;
  customer_cnic: string;
  customer_account: string;
  amount: string;
  currency: string;
  fee: string;
  tax: string;
  total_amount: string;
  transaction_status: string;
  transaction_date: string;
  branch_name: string;
  depositor_name: string;
  depositor_cnic: string;
  narration: string;
  // Digital signature fields
  digital_signature?: string;
  signature_hash?: string;
  signature_timestamp?: string;
  signature_algorithm?: string;
  is_signature_valid?: boolean;
  extra_data?: {
    // Cheque deposit fields
    cheque_number?: string;
    cheque_date?: string;
    cheque_bank?: string;
    cheque_branch?: string;
    account_holder_name?: string;
    micr_code?: string;
    // Pay order fields
    pay_order_number?: string;
    pay_order_date?: string;
    issuing_bank?: string;
    beneficiary_name?: string;
    // Bill payment fields
    bill_type?: string;
    consumer_number?: string;
    bill_month?: string;
    company_name?: string;
    bill_amount?: string;
    // Fund transfer fields
    beneficiary_account?: string;
    beneficiary_bank?: string;
    beneficiary_branch?: string;
    transfer_purpose?: string;
    // Generic
    [key: string]: string | undefined;
  };
}

// Helper function to get transaction type display label
const getTransactionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'CASH_DEPOSIT': 'Cash Deposit',
    'CHEQUE_DEPOSIT': 'Cheque',
    'PAY_ORDER': 'Pay Order',
    'BILL_PAYMENT': 'Bill Payment',
    'FUND_TRANSFER': 'Fund Transfer',
  };
  return labels[type] || type.replace(/_/g, ' ');
};

// Helper function to get field display label
const getFieldLabel = (field: string): string => {
  const labels: Record<string, string> = {
    // Cheque fields
    'cheque_number': 'Cheque Number',
    'cheque_date': 'Cheque Date',
    'cheque_bank': 'Bank Name',
    'cheque_branch': 'Bank Branch',
    'account_holder_name': 'Account Holder Name',
    'micr_code': 'MICR Code',
    // Pay order fields
    'pay_order_number': 'Pay Order Number',
    'pay_order_date': 'Pay Order Date',
    'issuing_bank': 'Issuing Bank',
    'beneficiary_name': 'Beneficiary Name',
    // Bill payment fields
    'bill_type': 'Bill Type',
    'consumer_number': 'Consumer Number',
    'bill_month': 'Bill Month',
    'company_name': 'Company',
    'bill_amount': 'Bill Amount',
    'due_date': 'Due Date',
    // Fund transfer fields
    'beneficiary_account': 'Beneficiary Account',
    'beneficiary_bank': 'Beneficiary Bank',
    'beneficiary_branch': 'Beneficiary Branch',
    'transfer_purpose': 'Purpose',
  };
  return labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

// Helper function to render extra data fields based on transaction type
const renderExtraDataFields = (transactionType: string, extraData: Record<string, string | undefined>) => {
  // Define which fields to show for each transaction type
  const typeFields: Record<string, string[]> = {
    'CHEQUE_DEPOSIT': ['cheque_number', 'cheque_date', 'cheque_bank', 'cheque_branch', 'account_holder_name', 'micr_code'],
    'PAY_ORDER': ['pay_order_number', 'pay_order_date', 'issuing_bank', 'beneficiary_name'],
    'BILL_PAYMENT': ['bill_type', 'company_name', 'consumer_number', 'bill_month', 'due_date'],
    'FUND_TRANSFER': ['beneficiary_name', 'beneficiary_account', 'beneficiary_bank', 'beneficiary_branch', 'transfer_purpose'],
  };

  const fieldsToShow = typeFields[transactionType] || Object.keys(extraData);

  return fieldsToShow.map(field => {
    const value = extraData[field];
    if (!value) return null;
    return (
      <div key={field} className="flex justify-between items-center py-1">
        <span className="text-sm text-gray-500">{getFieldLabel(field)}</span>
        <span className="text-sm font-medium text-gray-900">{value}</span>
      </div>
    );
  }).filter(Boolean);
};

interface SignatureVerification {
  is_authentic: boolean;
  message: string;
  signature_algorithm?: string;
  signature_timestamp?: string;
  signed_fields?: Record<string, string>;
  issuer?: string;
}

const ReceiptVerification: React.FC = () => {
  const { receiptNumber } = useParams<{ receiptNumber: string }>();
  const [searchParams] = useSearchParams();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [signatureVerification, setSignatureVerification] = useState<SignatureVerification | null>(null);
  const [verifyingSignature, setVerifyingSignature] = useState(false);

  useEffect(() => {
    const fetchReceipt = async () => {
      if (!receiptNumber) {
        setError('Receipt number not provided');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/v1/receipts/by-number/${receiptNumber}`);
        if (!response.ok) {
          throw new Error('Receipt not found');
        }
        const data = await response.json();
        setReceipt(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [receiptNumber]);

  const handleVerify = async () => {
    if (!receipt) return;

    setVerifying(true);
    try {
      const response = await fetch(`/api/v1/receipts/verify-by-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_number: receipt.receipt_number })
      });

      if (response.ok) {
        const data = await response.json();
        setReceipt(data.receipt);
        setVerified(true);
      }
    } catch (err) {
      console.error('Verification failed:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifySignature = async () => {
    if (!receipt) return;

    setVerifyingSignature(true);
    try {
      const response = await fetch(`/api/v1/receipts/verify-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_number: receipt.receipt_number })
      });

      if (response.ok) {
        const data = await response.json();
        setSignatureVerification({
          is_authentic: data.is_authentic,
          message: data.message,
          signature_algorithm: data.signature_algorithm,
          signature_timestamp: data.signature_timestamp,
          signed_fields: data.signed_fields,
          issuer: data.issuer
        });
      }
    } catch (err) {
      console.error('Signature verification failed:', err);
      setSignatureVerification({
        is_authentic: false,
        message: 'Verification failed. Please try again.'
      });
    } finally {
      setVerifyingSignature(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-PK', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const formatAmount = (amount: string, currency: string) => {
    return `${currency} ${parseFloat(amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <FiXCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Receipt Not Found</h1>
          <p className="text-gray-600">{error || 'The receipt you are looking for does not exist.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-accent to-accent-700 rounded-t-lg p-6 text-white text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BsBuilding className="w-8 h-8" />
            <h1 className="text-2xl font-bold">MEEZAN BANK</h1>
          </div>
          <p className="text-green-100">Digital Transaction Receipt</p>
        </div>

        {/* Receipt Content */}
        <div className="bg-white shadow-xl rounded-b-lg overflow-hidden">
          {/* Verification Status */}
          <div className={`p-4 flex items-center justify-center gap-2 ${
            verified || receipt.is_verified
              ? 'bg-green-50 text-green-700'
              : 'bg-primary-50 text-primary'
          }`}>
            {verified || receipt.is_verified ? (
              <>
                <FiCheckCircle className="w-5 h-5" />
                <span className="font-medium">Verified Receipt</span>
                <span className="text-sm">({receipt.verified_count} verification{receipt.verified_count !== 1 ? 's' : ''})</span>
              </>
            ) : (
              <>
                <FiShield className="w-5 h-5" />
                <span className="font-medium">Authentic Receipt</span>
              </>
            )}
          </div>

          {/* Amount */}
          <div className="text-center py-6 border-b">
            <p className="text-gray-500 text-sm mb-1">Transaction Amount</p>
            <p className="text-4xl font-bold text-accent">
              {formatAmount(receipt.amount, receipt.currency)}
            </p>
            {parseFloat(receipt.fee) > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Fee: {formatAmount(receipt.fee, receipt.currency)}
              </p>
            )}
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <DetailRow
              icon={<FiHash className="w-5 h-5 text-gray-400" />}
              label="Receipt Number"
              value={receipt.receipt_number}
            />
            <DetailRow
              icon={<FiFileText className="w-5 h-5 text-gray-400" />}
              label="Reference Number"
              value={receipt.reference_number}
            />
            <DetailRow
              icon={<FiCreditCard className="w-5 h-5 text-gray-400" />}
              label="Transaction Type"
              value={receipt.transaction_type.replace(/_/g, ' ')}
            />
            <DetailRow
              icon={<FiUser className="w-5 h-5 text-gray-400" />}
              label="Customer Name"
              value={receipt.customer_name}
            />
            <DetailRow
              icon={<FiCreditCard className="w-5 h-5 text-gray-400" />}
              label="Account Number"
              value={receipt.customer_account}
            />
            {receipt.depositor_name && (
              <DetailRow
                icon={<FiUser className="w-5 h-5 text-gray-400" />}
                label="Depositor"
                value={receipt.depositor_name}
              />
            )}
            <DetailRow
              icon={<FiCalendar className="w-5 h-5 text-gray-400" />}
              label="Date & Time"
              value={formatDate(receipt.transaction_date)}
            />
            <DetailRow
              icon={<BsBuilding className="w-5 h-5 text-gray-400" />}
              label="Branch"
              value={receipt.branch_name}
            />
            {receipt.narration && (
              <DetailRow
                icon={<FiFileText className="w-5 h-5 text-gray-400" />}
                label="Narration"
                value={receipt.narration}
              />
            )}

            {/* Type-Specific Details */}
            {receipt.extra_data && Object.keys(receipt.extra_data).length > 0 && (
              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {getTransactionTypeLabel(receipt.transaction_type)} Details
                </h3>
                <div className="space-y-3">
                  {renderExtraDataFields(receipt.transaction_type, receipt.extra_data)}
                </div>
              </div>
            )}

            {/* Status Badge */}
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-gray-500">Status</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                receipt.transaction_status === 'COMPLETED'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {receipt.transaction_status}
              </span>
            </div>
          </div>

          {/* Digital Signature Section */}
          <div className="border-t p-6 bg-gradient-to-r from-primary-50 to-primary-100">
            <div className="flex items-center gap-2 mb-4">
              <FiShield className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-semibold text-gray-800">Digital Signature (SBP Compliant)</h3>
            </div>

            {receipt.digital_signature ? (
              <>
                {/* Signature exists */}
                {signatureVerification ? (
                  <div className={`rounded-lg p-4 ${signatureVerification.is_authentic ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {signatureVerification.is_authentic ? (
                        <FiCheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <FiXCircle className="w-6 h-6 text-red-600" />
                      )}
                      <span className={`font-bold ${signatureVerification.is_authentic ? 'text-green-700' : 'text-red-700'}`}>
                        {signatureVerification.is_authentic ? 'AUTHENTIC RECEIPT' : 'VERIFICATION FAILED'}
                      </span>
                    </div>
                    <p className={`text-sm ${signatureVerification.is_authentic ? 'text-green-600' : 'text-red-600'}`}>
                      {signatureVerification.message}
                    </p>
                    {signatureVerification.is_authentic && (
                      <div className="mt-3 text-sm text-gray-600 space-y-1">
                        <p><span className="font-medium">Algorithm:</span> {signatureVerification.signature_algorithm}</p>
                        <p><span className="font-medium">Signed At:</span> {signatureVerification.signature_timestamp ? new Date(signatureVerification.signature_timestamp).toLocaleString() : 'N/A'}</p>
                        <p><span className="font-medium">Issuer:</span> {signatureVerification.issuer}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <FiCheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">This receipt is digitally signed</span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Algorithm:</span> {receipt.signature_algorithm || 'RSA-SHA256'}</p>
                      {receipt.signature_timestamp && (
                        <p><span className="font-medium">Signed At:</span> {new Date(receipt.signature_timestamp).toLocaleString()}</p>
                      )}
                      <p><span className="font-medium">Hash:</span> <code className="bg-gray-200 px-1 rounded text-xs">{receipt.signature_hash?.substring(0, 16)}...</code></p>
                    </div>
                    <button
                      onClick={handleVerifySignature}
                      disabled={verifyingSignature}
                      className="w-full bg-primary hover:bg-primary-600 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {verifyingSignature ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Verifying Signature...
                        </>
                      ) : (
                        <>
                          <FiShield className="w-5 h-5" />
                          Verify Digital Signature
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-gray-500">
                <FiXCircle className="w-5 h-5" />
                <span className="text-sm">This receipt was created before digital signatures were enabled</span>
              </div>
            )}
          </div>

          {/* QR Code */}
          {receipt.verification_qr_data && (
            <div className="border-t p-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-gray-500 mb-3">
                  <BsQrCode className="w-5 h-5" />
                  <span className="text-sm font-medium">Verification QR Code</span>
                </div>
                <img
                  src={receipt.verification_qr_data}
                  alt="Receipt QR Code"
                  className="mx-auto w-48 h-48 border rounded-lg p-2"
                />
              </div>
            </div>
          )}

          {/* Verify Button */}
          {!verified && !receipt.is_verified && (
            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full bg-accent hover:bg-accent-600 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <FiShield className="w-5 h-5" />
                    Verify This Receipt
                  </>
                )}
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 p-4 text-center text-sm text-gray-500 border-t">
            <p>This is a digitally generated receipt from Meezan Bank.</p>
            <p className="mt-1">Thank you for banking with us.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for detail rows
const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3">
    {icon}
    <div className="flex-1">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  </div>
);

export default ReceiptVerification;
