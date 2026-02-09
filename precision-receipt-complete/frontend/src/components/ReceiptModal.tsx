/**
 * Receipt Modal
 * Displays receipt details with QR code
 */

import React, { useState, useEffect } from 'react';
import { FiX, FiDownload, FiCheck, FiShare2, FiMessageCircle, FiMail, FiSend } from 'react-icons/fi';
import Button from './ui/Button';
import Card from './ui/Card';
import Input from './ui/Input';
import toast from 'react-hot-toast';
import { receiptService } from '../services/receipt.service';
import { ReceiptDetail, Transaction } from '../types';
import { transactionService } from '../services/transaction.service';
import { format } from 'date-fns';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  transactionId,
}) => {
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Send receipt state
  const [showSendOptions, setShowSendOptions] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');

  useEffect(() => {
    if (isOpen && transactionId) {
      loadReceipt();
    }
  }, [isOpen, transactionId]);

  const loadReceipt = async () => {
    setLoading(true);
    try {
      // Load receipt details
      const receiptData = await receiptService.getReceipt(transactionId);
      setReceipt(receiptData);

      // Load transaction for additional_data
      const txnData = await transactionService.getTransaction(transactionId);
      setTransaction(txnData);

      // Load QR code
      const qrData = await receiptService.getQRCode(transactionId, 'base64');
      setQrCode(qrData.qr_code);
    } catch (error) {
      toast.error('Failed to load receipt');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!receipt) return;
    setVerifying(true);
    try {
      const result = await receiptService.verifyReceipt(transactionId);
      if (result.is_valid) {
        toast.success(`Receipt verified! (${result.verified_count} total verifications)`);
        // Reload to update count
        loadReceipt();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = async () => {
    try {
      const result = await receiptService.downloadReceipt(transactionId, 'html');
      if (result.content) {
        // Create blob and download
        const blob = new Blob([result.content], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'receipt.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Receipt downloaded');
      }
    } catch (error) {
      toast.error('Download failed');
    }
  };

  const handleShare = async () => {
    if (!receipt) return;
    const shareText = `Receipt: ${receipt.receipt_number}\nAmount: ${receipt.currency} ${parseFloat(String(receipt.amount)).toLocaleString()}\nVerify: ${receipt.verification_url}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Transaction Receipt',
          text: shareText,
          url: receipt.verification_url || undefined,
        });
      } catch {
        // User cancelled or not supported
        navigator.clipboard.writeText(shareText);
        toast.success('Receipt info copied to clipboard');
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Receipt info copied to clipboard');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappNumber.trim()) {
      toast.error('Please enter a WhatsApp number');
      return;
    }

    setSendingWhatsApp(true);
    try {
      const result = await receiptService.sendReceipt(transactionId, 'whatsapp', whatsappNumber);
      if (result.success) {
        toast.success('Receipt sent to WhatsApp!');
        setWhatsappNumber('');
      } else {
        toast.error(result.message || 'Failed to send');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send WhatsApp');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setSendingEmail(true);
    try {
      const result = await receiptService.sendReceipt(transactionId, 'email', emailAddress);
      if (result.success) {
        toast.success('Receipt sent to Email!');
        setEmailAddress('');
      } else {
        toast.error(result.message || 'Failed to send');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send Email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendToCustomer = async () => {
    setSendingWhatsApp(true);
    setSendingEmail(true);
    try {
      const result = await receiptService.sendReceiptToCustomer(transactionId, {
        sendWhatsapp: true,
        sendEmail: true,
      });
      if (result.success) {
        toast.success(`Receipt sent via ${result.notifications.length} channel(s)`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send notifications');
    } finally {
      setSendingWhatsApp(false);
      setSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <Card padding="lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">Transaction Receipt</h2>
              {receipt && (
                <p className="text-sm text-text-secondary mt-1">
                  {receipt.receipt_number}
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
              <p className="mt-4 text-text-secondary">Loading receipt...</p>
            </div>
          ) : receipt ? (
            <>
              {/* Amount */}
              <div className="text-center py-6 bg-background-light rounded-lg mb-6">
                <p className="text-sm text-text-secondary">Amount</p>
                <p className="text-3xl font-bold text-primary mt-1">
                  {receipt.currency} {parseFloat(String(receipt.amount)).toLocaleString()}
                </p>
                <p className="text-sm text-text-secondary mt-2">
                  {receipt.transaction_type.replace('_', ' ')}
                </p>
              </div>

              {/* QR Code */}
              {qrCode && (
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-white rounded-lg border border-border">
                    <img
                      src={qrCode}
                      alt="Receipt QR Code"
                      className="w-48 h-48"
                    />
                    <p className="text-xs text-center text-text-secondary mt-2">
                      Scan to verify
                    </p>
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">Reference</span>
                  <span className="font-medium">{receipt.reference_number}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">Customer</span>
                  <span className="font-medium">{receipt.customer_name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">Account</span>
                  <span className="font-medium">{receipt.customer_account}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">Date</span>
                  <span className="font-medium">
                    {format(new Date(receipt.transaction_date), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">Status</span>
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-success-50 text-success border border-success">
                    {receipt.transaction_status}
                  </span>
                </div>
                {receipt.verified_count > 0 && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-text-secondary">Verifications</span>
                    <span className="font-medium text-success">
                      {receipt.verified_count} times
                    </span>
                  </div>
                )}

                {/* Transaction-specific Details */}
                {transaction?.transaction_type === 'CHEQUE_DEPOSIT' && transaction.additional_data && (
                  <>
                    <div className="pt-3 pb-1">
                      <span className="text-sm font-semibold text-text-primary">Cheque Details</span>
                    </div>
                    {transaction.additional_data.cheque_number && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Cheque Number</span>
                        <span className="font-medium">{transaction.additional_data.cheque_number}</span>
                      </div>
                    )}
                    {transaction.additional_data.cheque_bank && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Bank</span>
                        <span className="font-medium">{transaction.additional_data.cheque_bank}</span>
                      </div>
                    )}
                    {transaction.additional_data.cheque_date && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Cheque Date</span>
                        <span className="font-medium">{transaction.additional_data.cheque_date}</span>
                      </div>
                    )}
                  </>
                )}

                {transaction?.transaction_type === 'PAY_ORDER' && transaction.additional_data && (
                  <>
                    <div className="pt-3 pb-1">
                      <span className="text-sm font-semibold text-text-primary">Pay Order Details</span>
                    </div>
                    {transaction.additional_data.payee_name && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Payee Name</span>
                        <span className="font-medium">{transaction.additional_data.payee_name}</span>
                      </div>
                    )}
                    {transaction.additional_data.payee_cnic && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Payee CNIC</span>
                        <span className="font-medium">{transaction.additional_data.payee_cnic}</span>
                      </div>
                    )}
                    {transaction.additional_data.pay_order_purpose && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Purpose</span>
                        <span className="font-medium">{transaction.additional_data.pay_order_purpose}</span>
                      </div>
                    )}
                  </>
                )}

                {transaction?.transaction_type === 'BILL_PAYMENT' && transaction.additional_data && (
                  <>
                    <div className="pt-3 pb-1">
                      <span className="text-sm font-semibold text-text-primary">Bill Details</span>
                    </div>
                    {transaction.additional_data.biller_name && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Biller</span>
                        <span className="font-medium">{transaction.additional_data.biller_name}</span>
                      </div>
                    )}
                    {transaction.additional_data.consumer_number && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Consumer Number</span>
                        <span className="font-medium">{transaction.additional_data.consumer_number}</span>
                      </div>
                    )}
                    {transaction.additional_data.bill_reference && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Bill Reference</span>
                        <span className="font-medium">{transaction.additional_data.bill_reference}</span>
                      </div>
                    )}
                    {transaction.additional_data.bill_month && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Bill Month</span>
                        <span className="font-medium">{transaction.additional_data.bill_month}</span>
                      </div>
                    )}
                  </>
                )}

                {transaction?.transaction_type === 'FUND_TRANSFER' && transaction.additional_data && (
                  <>
                    <div className="pt-3 pb-1">
                      <span className="text-sm font-semibold text-text-primary">Transfer Details</span>
                    </div>
                    {transaction.additional_data.beneficiary_name && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Beneficiary</span>
                        <span className="font-medium">{transaction.additional_data.beneficiary_name}</span>
                      </div>
                    )}
                    {transaction.additional_data.beneficiary_bank && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Bank</span>
                        <span className="font-medium">{transaction.additional_data.beneficiary_bank}</span>
                      </div>
                    )}
                    {transaction.additional_data.beneficiary_account && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Account</span>
                        <span className="font-medium">{transaction.additional_data.beneficiary_account}</span>
                      </div>
                    )}
                    {transaction.additional_data.transfer_purpose && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Purpose</span>
                        <span className="font-medium">{transaction.additional_data.transfer_purpose}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Depositor Info for Cash Deposit */}
                {transaction?.transaction_type === 'CASH_DEPOSIT' && transaction.depositor_name && (
                  <>
                    <div className="pt-3 pb-1">
                      <span className="text-sm font-semibold text-text-primary">Depositor Details</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-text-secondary">Depositor Name</span>
                      <span className="font-medium">{transaction.depositor_name}</span>
                    </div>
                    {transaction.depositor_cnic && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Depositor CNIC</span>
                        <span className="font-medium">{transaction.depositor_cnic}</span>
                      </div>
                    )}
                    {transaction.depositor_phone && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Depositor Phone</span>
                        <span className="font-medium">{transaction.depositor_phone}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mb-4">
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<FiCheck />}
                  onClick={handleVerify}
                  loading={verifying}
                >
                  Verify
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<FiDownload />}
                  onClick={handleDownload}
                >
                  Download
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<FiShare2 />}
                  onClick={handleShare}
                >
                  Share
                </Button>
              </div>

              {/* Send Receipt Options */}
              <div className="border-t border-border pt-4">
                <button
                  onClick={() => setShowSendOptions(!showSendOptions)}
                  className="w-full flex items-center justify-between py-2 text-left"
                >
                  <span className="font-semibold text-text-primary flex items-center gap-2">
                    <FiSend className="w-4 h-4" />
                    Send Receipt to Customer
                  </span>
                  <span className="text-text-secondary text-sm">
                    {showSendOptions ? '▲' : '▼'}
                  </span>
                </button>

                {showSendOptions && (
                  <div className="mt-4 space-y-4">
                    {/* Quick Send to Customer's Registered Contacts */}
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={handleSendToCustomer}
                      loading={sendingWhatsApp || sendingEmail}
                      leftIcon={<FiSend />}
                    >
                      Send to Customer's WhatsApp & Email
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-white text-text-secondary">or send to custom address</span>
                      </div>
                    </div>

                    {/* WhatsApp */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="WhatsApp number (+923001234567)"
                          value={whatsappNumber}
                          onChange={(e) => setWhatsappNumber(e.target.value)}
                          leftIcon={<FiMessageCircle className="text-green-500" />}
                          fullWidth
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleSendWhatsApp}
                        loading={sendingWhatsApp}
                        className="!border-green-500 !text-green-600 hover:!bg-green-50"
                      >
                        Send
                      </Button>
                    </div>

                    {/* Email */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="Email address"
                          type="email"
                          value={emailAddress}
                          onChange={(e) => setEmailAddress(e.target.value)}
                          leftIcon={<FiMail className="text-blue-500" />}
                          fullWidth
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleSendEmail}
                        loading={sendingEmail}
                        className="!border-blue-500 !text-blue-600 hover:!bg-blue-50"
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-border text-center">
                <p className="text-xs text-text-secondary">
                  This is a digitally generated receipt from Meezan Bank.
                </p>
                {receipt.verification_url && (
                  <a
                    href={receipt.verification_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline mt-1 inline-block"
                  >
                    {receipt.verification_url}
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-text-secondary">
              Receipt not found
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ReceiptModal;
