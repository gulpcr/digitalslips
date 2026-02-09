/**
 * DRID Lookup Modal
 * Teller interface to retrieve and process deposit slips by DRID
 */

import React, { useState } from 'react';
import { FiX, FiSearch, FiCheck, FiAlertCircle, FiClock, FiUser, FiDollarSign, FiFileText, FiCheckCircle, FiXCircle, FiImage } from 'react-icons/fi';
import Button from './ui/Button';
import Card from './ui/Card';
import Input from './ui/Input';
import toast from 'react-hot-toast';
import {
  depositSlipService,
  DepositSlipResponse,
  DepositSlipRetrieveResponse,
} from '../services/depositSlip.service';

interface DRIDLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (transactionId: string, receiptNumber?: string) => void;
}

type Step = 'lookup' | 'retrieved' | 'verify' | 'complete' | 'success';

const DRIDLookupModal: React.FC<DRIDLookupModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<Step>('lookup');
  const [drid, setDrid] = useState('');
  const [loading, setLoading] = useState(false);
  const [depositSlip, setDepositSlip] = useState<DepositSlipResponse | null>(null);
  const [validationResult, setValidationResult] = useState<DepositSlipRetrieveResponse['validation_result'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Verification form state
  const [amountConfirmed, setAmountConfirmed] = useState(false);
  const [depositorVerified, setDepositorVerified] = useState(false);
  const [instrumentVerified, setInstrumentVerified] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState('');

  // Completion state
  const [authorizationCaptured, setAuthorizationCaptured] = useState(false);
  const [tellerNotes, setTellerNotes] = useState('');
  const [completionResult, setCompletionResult] = useState<{
    transaction_id: string;
    transaction_reference: string;
    receipt_number?: string;
  } | null>(null);

  // OTP state
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState('');

  const resetModal = () => {
    setStep('lookup');
    setDrid('');
    setDepositSlip(null);
    setValidationResult(null);
    setError(null);
    setAmountConfirmed(false);
    setDepositorVerified(false);
    setInstrumentVerified(false);
    setVerifyNotes('');
    setAuthorizationCaptured(false);
    setTellerNotes('');
    setCompletionResult(null);
    setOtp('');
    setOtpSent(false);
    setOtpVerified(false);
    setOtpError('');
    setOtpLoading(false);
    setMaskedPhone('');
  };

  const handleSendOtp = async () => {
    if (!depositSlip) return;

    setOtpLoading(true);
    setOtpError('');

    try {
      const response = await depositSlipService.sendOtp(depositSlip.drid);

      if (response.success) {
        setOtpSent(true);
        setMaskedPhone(response.phone_masked);
        toast.success(response.message);
      } else {
        setOtpError(response.message);
        toast.error(response.message);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const message = err.response?.data?.detail || 'Failed to send OTP';
      setOtpError(message);
      toast.error(message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!depositSlip || otp.length !== 5) return;

    setOtpLoading(true);
    setOtpError('');

    try {
      const response = await depositSlipService.verifyOtp(depositSlip.drid, otp);

      if (response.success && response.verified) {
        setOtpVerified(true);
        toast.success('OTP verified successfully');
      } else {
        setOtpError(response.message);
        setOtpVerified(false);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string; message?: string } } };
      const message = err.response?.data?.detail || err.response?.data?.message || 'OTP verification failed';
      setOtpError(message);
      setOtpVerified(false);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleLookup = async () => {
    if (!drid.trim()) {
      toast.error('Please enter a DRID');
      return;
    }

    // Check if user is authenticated
    const token = localStorage.getItem('access_token');
    if (!token) {
      toast.error('Please login to retrieve deposit slips');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await depositSlipService.retrieve(drid.trim().toUpperCase());

      if (!response.success) {
        toast.error(response.message);
        setValidationResult(response.validation_result || null);
        return;
      }

      setDepositSlip(response.deposit_slip || null);
      setValidationResult(response.validation_result || null);
      setStep('retrieved');
      toast.success('Deposit slip retrieved successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string; message?: string }; status?: number } };

      if (err.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        setError('Authentication required. Please login to retrieve deposit slips.');
      } else if (err.response?.status === 404) {
        toast.error('DRID not found');
        setError(`No deposit slip found with DRID: ${drid}`);
      } else {
        const message = err.response?.data?.detail || err.response?.data?.message || 'Failed to retrieve deposit slip';
        toast.error(message);
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!depositSlip) return;

    setLoading(true);
    try {
      const needsInstrumentVerification = ['CHEQUE_DEPOSIT', 'PAY_ORDER'].includes(
        depositSlip.transaction_type
      );

      await depositSlipService.verify(depositSlip.drid, {
        amount_confirmed: amountConfirmed,
        depositor_identity_verified: depositorVerified,
        instrument_verified: needsInstrumentVerification ? instrumentVerified : undefined,
        notes: verifyNotes || undefined,
      });

      setStep('complete');
      toast.success('Details verified successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!depositSlip) return;

    setLoading(true);
    try {
      const response = await depositSlipService.complete(depositSlip.drid, {
        authorization_captured: authorizationCaptured,
        teller_notes: tellerNotes || undefined,
      });

      setCompletionResult({
        transaction_id: response.transaction_id,
        transaction_reference: response.transaction_reference,
        receipt_number: response.receipt_number,
      });
      setStep('success');
      toast.success('Transaction completed successfully!');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to complete transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReceipt = () => {
    if (completionResult) {
      onComplete(completionResult.transaction_id, completionResult.receipt_number);
      handleClose();
    }
  };

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return 'Expired';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (!isOpen) return null;

  const needsInstrumentVerification =
    depositSlip && ['CHEQUE_DEPOSIT', 'PAY_ORDER'].includes(depositSlip.transaction_type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <Card padding="lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">DRID Transaction</h2>
              <p className="text-sm text-text-secondary mt-1">
                {step === 'lookup' && 'Enter customer DRID to retrieve deposit slip'}
                {step === 'retrieved' && 'Review and verify transaction details'}
                {step === 'verify' && 'Confirm verification'}
                {step === 'complete' && 'Capture authorization and complete'}
                {step === 'success' && 'Transaction completed successfully'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-text-secondary hover:text-text-primary"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {/* Step: Lookup */}
          {step === 'lookup' && (
            <div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLookup();
                }}
                className="flex gap-3 mb-6"
              >
                <Input
                  placeholder="Enter DRID (e.g., DRID-20240128-ABC123)"
                  value={drid}
                  onChange={(e) => {
                    setDrid(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  leftIcon={<FiSearch />}
                  fullWidth
                  autoFocus
                />
                <Button
                  variant="primary"
                  type="submit"
                  loading={loading}
                >
                  Retrieve
                </Button>
              </form>

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-error-50 border border-error rounded-lg mb-4">
                  <div className="flex items-center gap-2 text-error">
                    <FiAlertCircle className="w-5 h-5" />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="text-sm text-text-secondary mt-1">{error}</p>
                </div>
              )}

              {validationResult && !validationResult.is_valid && (
                <div className="p-4 bg-error-50 border border-error rounded-lg">
                  <div className="flex items-center gap-2 text-error mb-2">
                    <FiAlertCircle className="w-5 h-5" />
                    <span className="font-medium">Validation Failed</span>
                  </div>
                  <p className="text-sm text-text-secondary">{validationResult.message}</p>
                  <div className="mt-2 text-sm">
                    <span className="text-text-secondary">Status: </span>
                    <span className="font-medium">{validationResult.status}</span>
                  </div>
                </div>
              )}

              <div className="mt-6 p-4 bg-background-light rounded-lg">
                <h3 className="font-medium text-text-primary mb-2">Instructions</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-text-secondary">
                  <li>Ask customer for their Digital Reference ID (DRID)</li>
                  <li>Enter the DRID above and click Retrieve</li>
                  <li>Verify the pre-filled details with the customer</li>
                  <li>Count cash/verify instrument and confirm amount</li>
                  <li>Capture customer authorization and complete transaction</li>
                </ol>
              </div>
            </div>
          )}

          {/* Step: Retrieved - Show Details */}
          {step === 'retrieved' && depositSlip && (
            <div>
              {/* Time Warning */}
              <div className="flex items-center gap-2 p-3 bg-warning-50 border border-warning rounded-lg mb-4">
                <FiClock className="w-5 h-5 text-warning" />
                <span className="text-sm font-medium text-warning">
                  Time Remaining: {formatTimeRemaining(depositSlip.time_remaining_seconds)}
                </span>
              </div>

              {/* Transaction Details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-background-light rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FiDollarSign className="w-5 h-5 text-accent" />
                    <span className="text-sm text-text-secondary">Amount</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {depositSlip.currency} {parseFloat(String(depositSlip.amount)).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-background-light rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FiFileText className="w-5 h-5 text-accent" />
                    <span className="text-sm text-text-secondary">Type</span>
                  </div>
                  <p className="text-lg font-semibold text-text-primary">
                    {depositSlip.transaction_type.replace('_', ' ')}
                  </p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="mb-4">
                <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <FiUser className="w-4 h-4" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-text-secondary">Name:</span>
                    <p className="font-medium">{depositSlip.customer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-text-secondary">CNIC:</span>
                    <p className="font-medium">{depositSlip.customer_cnic}</p>
                  </div>
                  <div>
                    <span className="text-text-secondary">Account:</span>
                    <p className="font-medium">{depositSlip.customer_account}</p>
                  </div>
                  <div>
                    <span className="text-text-secondary">Branch:</span>
                    <p className="font-medium">{depositSlip.branch_name || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Depositor Info */}
              {depositSlip.depositor_name && (
                <div className="mb-4 p-4 bg-accent-50 rounded-lg">
                  <h3 className="font-semibold text-text-primary mb-2">Depositor (Verify Identity)</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-text-secondary">Name:</span>
                      <p className="font-medium">{depositSlip.depositor_name}</p>
                    </div>
                    {depositSlip.depositor_cnic && (
                      <div>
                        <span className="text-text-secondary">CNIC:</span>
                        <p className="font-medium">{depositSlip.depositor_cnic}</p>
                      </div>
                    )}
                    {depositSlip.depositor_relationship && (
                      <div>
                        <span className="text-text-secondary">Relationship:</span>
                        <p className="font-medium">{depositSlip.depositor_relationship}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cheque Details (for CHEQUE_DEPOSIT) */}
              {depositSlip.transaction_type === 'CHEQUE_DEPOSIT' && depositSlip.additional_data && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <FiFileText className="w-4 h-4 text-blue-600" />
                    Cheque Details (Scanned)
                  </h3>

                  {/* Cheque Image */}
                  {depositSlip.additional_data.cheque_image && (
                    <div className="mb-4">
                      <p className="text-xs text-text-secondary mb-2 flex items-center gap-1">
                        <FiImage className="w-3 h-3" /> Original Cheque Image
                      </p>
                      <div className="bg-white rounded-lg border border-border overflow-hidden">
                        <img
                          src={depositSlip.additional_data.cheque_image}
                          alt="Scanned cheque"
                          className="w-full h-48 object-contain"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-text-secondary">Bank Name:</span>
                      <p className="font-medium">{depositSlip.additional_data.cheque_bank || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Cheque Date:</span>
                      <p className="font-medium">{depositSlip.additional_data.cheque_date || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Account Holder (Cheque Owner):</span>
                      <p className="font-medium text-primary">{depositSlip.additional_data.cheque_account_holder_name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Payee Name (Pay To):</span>
                      <p className="font-medium">{depositSlip.additional_data.cheque_payee_name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Cheque Number:</span>
                      <p className="font-medium">{depositSlip.additional_data.cheque_number || 'N/A'}</p>
                    </div>
                    {depositSlip.additional_data.cheque_amount_in_words && (
                      <div className="col-span-2">
                        <span className="text-text-secondary">Amount in Words:</span>
                        <p className="font-medium">{depositSlip.additional_data.cheque_amount_in_words}</p>
                      </div>
                    )}
                    {depositSlip.additional_data.cheque_branch && (
                      <div>
                        <span className="text-text-secondary">Branch:</span>
                        <p className="font-medium">{depositSlip.additional_data.cheque_branch}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-text-secondary">Signature Status:</span>
                      <p className="mt-1">
                        {depositSlip.additional_data.cheque_signature_status === 'present' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <FiCheckCircle className="w-3 h-3" /> Present
                          </span>
                        ) : depositSlip.additional_data.cheque_signature_status === 'missing' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            <FiXCircle className="w-3 h-3" /> Missing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                            <FiAlertCircle className="w-3 h-3" /> Unclear
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Narration */}
              {depositSlip.narration && (
                <div className="mb-4">
                  <span className="text-sm text-text-secondary">Narration:</span>
                  <p className="text-sm bg-background-light p-2 rounded mt-1">
                    {depositSlip.narration}
                  </p>
                </div>
              )}

              {/* Verification Checkboxes */}
              <div className="border-t border-border pt-4 mb-4">
                <h3 className="font-semibold text-text-primary mb-3">Verification Checklist</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={amountConfirmed}
                      onChange={(e) => setAmountConfirmed(e.target.checked)}
                      className="w-5 h-5 rounded border-border text-accent focus:ring-accent"
                    />
                    <span className="text-sm">
                      Amount confirmed: <strong>{depositSlip.currency} {parseFloat(String(depositSlip.amount)).toLocaleString()}</strong>
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={depositorVerified}
                      onChange={(e) => setDepositorVerified(e.target.checked)}
                      className="w-5 h-5 rounded border-border text-accent focus:ring-accent"
                    />
                    <span className="text-sm">
                      Depositor identity verified (CNIC checked)
                    </span>
                  </label>

                  {needsInstrumentVerification && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={instrumentVerified}
                        onChange={(e) => setInstrumentVerified(e.target.checked)}
                        className="w-5 h-5 rounded border-border text-accent focus:ring-accent"
                      />
                      <span className="text-sm">
                        Instrument verified (Cheque/Pay Order details correct)
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent resize-y min-h-[60px]"
                  placeholder="Any observations or notes"
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setStep('lookup')}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleVerify}
                  loading={loading}
                  disabled={!amountConfirmed || !depositorVerified || (needsInstrumentVerification && !instrumentVerified)}
                >
                  Verify & Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && depositSlip && (
            <div>
              <div className="p-4 bg-success-50 border border-success rounded-lg mb-6">
                <div className="flex items-center gap-2 text-success mb-2">
                  <FiCheck className="w-5 h-5" />
                  <span className="font-medium">Details Verified</span>
                </div>
                <p className="text-sm text-text-secondary">
                  Ready to complete transaction for {depositSlip.currency} {parseFloat(String(depositSlip.amount)).toLocaleString()}
                </p>
              </div>

              {/* OTP Verification */}
              <div className="mb-6 p-4 border border-border rounded-lg">
                <h3 className="font-semibold text-text-primary mb-3">OTP Verification</h3>
                <p className="text-sm text-text-secondary mb-4">
                  Send OTP to customer's registered mobile number for transaction authorization
                  {maskedPhone && <span className="font-medium"> ({maskedPhone})</span>}
                </p>

                {!otpSent ? (
                  <Button
                    variant="accent"
                    onClick={handleSendOtp}
                    className="w-full"
                    loading={otpLoading}
                  >
                    Send OTP to Customer
                  </Button>
                ) : (
                  <div>
                    <div className="flex gap-3 mb-2">
                      <Input
                        placeholder="Enter 5-digit OTP"
                        value={otp}
                        onChange={(e) => {
                          setOtp(e.target.value.replace(/\D/g, '').slice(0, 5));
                          setOtpError('');
                        }}
                        maxLength={5}
                        fullWidth
                        disabled={otpVerified}
                      />
                      <Button
                        variant={otpVerified ? 'outline' : 'primary'}
                        onClick={handleVerifyOtp}
                        disabled={otp.length !== 5 || otpVerified || otpLoading}
                        loading={otpLoading}
                      >
                        {otpVerified ? 'Verified' : 'Verify'}
                      </Button>
                    </div>

                    {otpError && (
                      <p className="text-sm text-error mb-2">{otpError}</p>
                    )}

                    {otpVerified && (
                      <div className="flex items-center gap-2 text-success text-sm">
                        <FiCheck className="w-4 h-4" />
                        <span>OTP verified successfully</span>
                      </div>
                    )}

                    {!otpVerified && (
                      <button
                        onClick={handleSendOtp}
                        className="text-sm text-accent hover:underline mt-2"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Authorization */}
              <div className="mb-4">
                <h3 className="font-semibold text-text-primary mb-3">Customer Authorization</h3>
                <label className={`flex items-center gap-3 cursor-pointer p-4 border rounded-lg ${!otpVerified ? 'border-border opacity-50' : 'border-border'}`}>
                  <input
                    type="checkbox"
                    checked={authorizationCaptured}
                    onChange={(e) => setAuthorizationCaptured(e.target.checked)}
                    className="w-5 h-5 rounded border-border text-accent focus:ring-accent"
                    disabled={!otpVerified}
                  />
                  <div>
                    <span className="text-sm font-medium">
                      I confirm that customer authorization has been captured
                    </span>
                    <p className="text-xs text-text-secondary mt-1">
                      Customer has signed or provided verbal confirmation for this transaction
                    </p>
                  </div>
                </label>
              </div>

              {/* Teller Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Teller Notes (Optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent resize-y min-h-[60px]"
                  placeholder="Any additional notes"
                  value={tellerNotes}
                  onChange={(e) => setTellerNotes(e.target.value)}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setStep('retrieved')}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleComplete}
                  loading={loading}
                  disabled={!authorizationCaptured || !otpVerified}
                >
                  Complete Transaction
                </Button>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && completionResult && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-success rounded-full mb-4">
                <FiCheck className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                Transaction Completed!
              </h3>
              <p className="text-text-secondary mb-6">
                Reference: {completionResult.transaction_reference}
              </p>

              {completionResult.receipt_number && (
                <div className="p-4 bg-background-light rounded-lg mb-6">
                  <p className="text-sm text-text-secondary">Receipt Number</p>
                  <p className="text-lg font-bold text-primary">
                    {completionResult.receipt_number}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={handleClose}>
                  Close
                </Button>
                <Button variant="primary" fullWidth onClick={handleViewReceipt}>
                  View Receipt
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DRIDLookupModal;
