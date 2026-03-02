/**
 * Bank Islami CIO Mobile Demo Page
 *
 * PURPOSE: Demo for Bank Islami CIO — shows customer-facing deposit slip flow
 *          in a realistic mobile phone frame (browser-rendered, no native app needed).
 *
 * PREREQUISITES:
 *   1. Run /demo page first to seed customer data into DB.
 *   2. Hardcoded CNIC 42101-9876543-2 must match a seeded customer.
 *   3. No login required — /demo/mobile is a public route.
 *
 * USAGE:
 *   Navigate to http://localhost:5174/demo/mobile
 *   After getting the DRID on the success screen, go to the Dashboard and
 *   use the DRID Lookup Modal to complete the transaction as a teller.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { depositSlipService, DepositSlipCreateResponse } from '../services/depositSlip.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'home' | 'select-type' | 'form' | 'review' | 'success';

type TransactionType =
  | 'CASH_DEPOSIT'
  | 'CHEQUE_DEPOSIT'
  | 'PAY_ORDER'
  | 'BILL_PAYMENT'
  | 'FUND_TRANSFER';

interface FormState {
  accountNumber: string;
  amount: string;
  narration: string;
  depositorRelationship: string;
  // Cheque deposit
  chequeNumber: string;
  chequeDate: string;
  chequeBank: string;
  // Pay order
  payeeName: string;
  payeeCnic: string;
  // Bill payment
  billType: string;
  consumerNumber: string;
  billerName: string;
  // Fund transfer
  beneficiaryName: string;
  beneficiaryAccount: string;
  beneficiaryBank: string;
  transferType: string;
}

const defaultForm: FormState = {
  accountNumber: '',
  amount: '',
  narration: '',
  depositorRelationship: 'SELF',
  chequeNumber: '',
  chequeDate: '',
  chequeBank: '',
  payeeName: '',
  payeeCnic: '',
  billType: '',
  consumerNumber: '',
  billerName: '',
  beneficiaryName: '',
  beneficiaryAccount: '',
  beneficiaryBank: '',
  transferType: 'IBFT',
};

const TRANSACTION_TYPES: { type: TransactionType; label: string; icon: string; desc: string }[] = [
  { type: 'CASH_DEPOSIT', label: 'Cash Deposit', icon: '💵', desc: 'Deposit cash into your account' },
  { type: 'CHEQUE_DEPOSIT', label: 'Cheque Deposit', icon: '📋', desc: 'Deposit a cheque instrument' },
  { type: 'PAY_ORDER', label: 'Pay Order', icon: '📄', desc: 'Submit a bank pay order' },
  { type: 'BILL_PAYMENT', label: 'Bill Payment', icon: '🧾', desc: 'Pay utility or other bills' },
  { type: 'FUND_TRANSFER', label: 'Fund Transfer', icon: '🔄', desc: 'Transfer to another account' },
];

const DEMO_CNIC = '42101-9876543-2';

// ─── Inline SVG helpers ───────────────────────────────────────────────────────

const SignalBars = () => (
  <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
    <rect x="0" y="8" width="3" height="4" rx="0.5" opacity="1" />
    <rect x="4.5" y="5" width="3" height="7" rx="0.5" opacity="1" />
    <rect x="9" y="2" width="3" height="10" rx="0.5" opacity="1" />
    <rect x="13.5" y="0" width="3" height="12" rx="0.5" opacity="1" />
  </svg>
);

const BatteryIcon = () => (
  <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
    <rect x="0.5" y="0.5" width="21" height="11" rx="2.5" stroke="currentColor" strokeWidth="1" />
    <rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor" />
    <path d="M23 4v4a2 2 0 0 0 0-4z" fill="currentColor" opacity="0.4" />
  </svg>
);

const IslamicPattern = () => (
  <svg width="100%" height="100%" className="absolute inset-0 opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="islamic" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <polygon points="20,2 26,14 38,14 29,22 32,34 20,28 8,34 11,22 2,14 14,14" fill="none" stroke="white" strokeWidth="1" />
        <circle cx="20" cy="20" r="4" fill="none" stroke="white" strokeWidth="0.8" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#islamic)" />
  </svg>
);

// ─── QR Code renderer (simple SVG grid from base64/URL data) ──────────────────
// We display the qr_code_data string visually as a styled code block with
// a decorative QR placeholder, since actual QR rendering requires a library.
// The DRID itself is machine-readable and scannable from the teller dashboard.

const QrDisplay = ({ drid }: { qrData?: string; drid: string }) => {
  // Generate a deterministic-looking QR grid from the DRID characters
  const cells = 21;
  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      // Finder patterns (corners)
      const inFinder =
        (r < 7 && c < 7) ||
        (r < 7 && c >= cells - 7) ||
        (r >= cells - 7 && c < 7);
      if (inFinder) {
        const edgeR = r % 7;
        const adjustedC = c >= cells - 7 ? c - (cells - 7) : c;
        return (
          (edgeR === 0 || edgeR === 6 || adjustedC === 0 || adjustedC === 6) ||
          (edgeR >= 2 && edgeR <= 4 && adjustedC >= 2 && adjustedC <= 4)
        );
      }
      // Data pattern — pseudo-random from DRID
      const charCode = drid.charCodeAt((r * cells + c) % drid.length) || 65;
      return (charCode + r * 3 + c * 7) % 3 !== 0;
    })
  );

  return (
    <div className="bg-white p-3 rounded-xl inline-block shadow-md">
      <svg width="140" height="140" viewBox={`0 0 ${cells} ${cells}`}>
        {grid.map((row, r) =>
          row.map((on, c) =>
            on ? (
              <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#006B3F" />
            ) : null
          )
        )}
      </svg>
      <p className="text-center text-[9px] text-gray-400 mt-1 font-mono">{drid}</p>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const MobileDemo: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedType, setSelectedType] = useState<TransactionType>('CASH_DEPOSIT');
  const [formState, setFormState] = useState<FormState>(defaultForm);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<DepositSlipCreateResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [screenKey, setScreenKey] = useState(0);

  // Live clock
  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: false });
    };
    setCurrentTime(fmt());
    const id = setInterval(() => setCurrentTime(fmt()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (currentScreen !== 'success' || !successData) return;
    const expiresAt = new Date(successData.expires_at).getTime();
    const initial = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    setSecondsLeft(initial);
    const id = setInterval(() => setSecondsLeft((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [currentScreen, successData]);

  const navigate = useCallback((screen: Screen) => {
    setCurrentScreen(screen);
    setScreenKey((k) => k + 1);
    setSubmitError(null);
  }, []);

  const handleField = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setSubmitError(null);
    try {
      const additionalData: Record<string, string> = {};
      if (selectedType === 'CHEQUE_DEPOSIT') {
        if (formState.chequeNumber) additionalData.cheque_number = formState.chequeNumber;
        if (formState.chequeDate) additionalData.cheque_date = formState.chequeDate;
        if (formState.chequeBank) additionalData.cheque_bank = formState.chequeBank;
      } else if (selectedType === 'PAY_ORDER') {
        if (formState.payeeName) additionalData.payee_name = formState.payeeName;
        if (formState.payeeCnic) additionalData.payee_cnic = formState.payeeCnic;
      } else if (selectedType === 'BILL_PAYMENT') {
        if (formState.billType) additionalData.bill_type = formState.billType;
        if (formState.consumerNumber) additionalData.consumer_number = formState.consumerNumber;
        if (formState.billerName) additionalData.biller_name = formState.billerName;
      } else if (selectedType === 'FUND_TRANSFER') {
        if (formState.beneficiaryName) additionalData.beneficiary_name = formState.beneficiaryName;
        if (formState.beneficiaryAccount) additionalData.beneficiary_account = formState.beneficiaryAccount;
        if (formState.beneficiaryBank) additionalData.beneficiary_bank = formState.beneficiaryBank;
        additionalData.transfer_type = formState.transferType || 'IBFT';
      }

      const result = await depositSlipService.initiate({
        transaction_type: selectedType,
        customer_cnic: DEMO_CNIC,
        customer_account: formState.accountNumber,
        amount: parseFloat(formState.amount),
        currency: 'PKR',
        narration: formState.narration || undefined,
        depositor_relationship: formState.depositorRelationship || 'SELF',
        channel: 'MOBILE',
        additional_data: Object.keys(additionalData).length > 0 ? additionalData : undefined,
      });

      setSuccessData(result);
      navigate('success');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string; message?: string } } };
      const msg =
        axiosErr?.response?.data?.detail ||
        axiosErr?.response?.data?.message ||
        'Something went wrong. Please try again.';
      setSubmitError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectedTypeInfo = TRANSACTION_TYPES.find((t) => t.type === selectedType)!;

  // ── Screen renderers ────────────────────────────────────────────────────────

  const renderHome = () => (
    <div className="flex flex-col h-full">
      {/* Green header */}
      <div className="relative bg-[#006B3F] px-5 pt-10 pb-8 overflow-hidden">
        <IslamicPattern />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-white/70 text-xs">Assalam-o-Alaikum</p>
              <p className="text-white font-bold text-lg">Muhammad Ali</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-lg font-bold">M</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <p className="text-white/70 text-xs mb-1">Current Account Balance</p>
            <p className="text-white text-3xl font-bold tracking-tight">PKR 1,24,500.00</p>
            <p className="text-[#C9A84C] text-xs mt-1">Account: PK36BKIP0000123456789012</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Quick Actions</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: '📤', label: 'Send' },
              { icon: '📥', label: 'Receive' },
              { icon: '💳', label: 'Cards' },
              { icon: '📊', label: 'History' },
            ].map((a) => (
              <button key={a.label} className="flex flex-col items-center gap-1 py-2">
                <span className="text-2xl">{a.icon}</span>
                <span className="text-[10px] text-gray-500">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="flex-1 px-4 mt-4 overflow-y-auto">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Recent</p>
        {[
          { label: 'Salary Credit', date: 'Feb 22', amount: '+85,000', color: 'text-green-600' },
          { label: 'Electricity Bill', date: 'Feb 20', amount: '-4,200', color: 'text-red-500' },
          { label: 'Fund Transfer', date: 'Feb 18', amount: '-15,000', color: 'text-red-500' },
        ].map((tx) => (
          <div key={tx.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">
                {tx.label[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{tx.label}</p>
                <p className="text-xs text-gray-400">{tx.date}</p>
              </div>
            </div>
            <span className={`text-sm font-semibold ${tx.color}`}>{tx.amount}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="px-4 pb-4 mt-auto">
        <button
          onClick={() => navigate('select-type')}
          className="w-full bg-[#006B3F] text-white py-4 rounded-2xl font-bold text-base shadow-lg active:scale-95 transition-transform"
        >
          + Create Deposit Slip
        </button>
      </div>
    </div>
  );

  const renderSelectType = () => (
    <div className="flex flex-col h-full">
      <div className="relative bg-[#006B3F] px-5 pt-10 pb-6 overflow-hidden">
        <IslamicPattern />
        <div className="relative z-10 flex items-center gap-3">
          <button onClick={() => navigate('home')} className="text-white/80 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <p className="text-white font-bold text-lg">New Deposit Slip</p>
            <p className="text-white/60 text-xs">Select transaction type</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {TRANSACTION_TYPES.map(({ type, label, icon, desc }) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${
              selectedType === type
                ? 'border-[#006B3F] bg-[#006B3F]/5'
                : 'border-gray-100 bg-white'
            }`}
          >
            <span className="text-2xl">{icon}</span>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${selectedType === type ? 'text-[#006B3F]' : 'text-gray-800'}`}>
                {label}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
            {selectedType === type && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#006B3F" />
                <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        ))}
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={() => navigate('form')}
          className="w-full bg-[#006B3F] text-white py-4 rounded-2xl font-bold text-base shadow-lg active:scale-95 transition-transform"
        >
          Continue
        </button>
      </div>
    </div>
  );

  const renderForm = () => {
    const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1';
    const inputCls =
      'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#006B3F] focus:ring-1 focus:ring-[#006B3F]/20 bg-gray-50';

    return (
      <div className="flex flex-col h-full">
        <div className="relative bg-[#006B3F] px-5 pt-10 pb-6 overflow-hidden">
          <IslamicPattern />
          <div className="relative z-10 flex items-center gap-3">
            <button onClick={() => navigate('select-type')} className="text-white/80 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <div>
              <p className="text-white font-bold text-lg">{selectedTypeInfo.label}</p>
              <p className="text-white/60 text-xs">Fill in the details</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden px-4 py-4 space-y-4">
          {/* Account Number */}
          <div>
            <label className={labelCls}>Account Number</label>
            <input
              type="text"
              className={inputCls}
              placeholder="e.g. PK36BKIP0000123456789012"
              value={formState.accountNumber}
              onChange={(e) => handleField('accountNumber', e.target.value)}
            />
          </div>

          {/* Amount */}
          <div>
            <label className={labelCls}>Amount (PKR)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0.00"
              value={formState.amount}
              onChange={(e) => handleField('amount', e.target.value)}
            />
          </div>

          {/* Narration */}
          <div>
            <label className={labelCls}>Narration (Optional)</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Purpose of deposit"
              value={formState.narration}
              onChange={(e) => handleField('narration', e.target.value)}
            />
          </div>

          {/* Depositor relationship */}
          <div>
            <label className={labelCls}>Depositor Relationship</label>
            <select
              className={inputCls}
              value={formState.depositorRelationship}
              onChange={(e) => handleField('depositorRelationship', e.target.value)}
            >
              <option value="SELF">Self</option>
              <option value="FAMILY">Family Member</option>
              <option value="EMPLOYER">Employer</option>
              <option value="AGENT">Authorized Agent</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Type-specific fields */}
          {selectedType === 'CHEQUE_DEPOSIT' && (
            <>
              <div>
                <label className={labelCls}>Cheque Number</label>
                <input type="text" className={inputCls} placeholder="e.g. 0012345" value={formState.chequeNumber} onChange={(e) => handleField('chequeNumber', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Cheque Date</label>
                <input type="date" className={inputCls} value={formState.chequeDate} onChange={(e) => handleField('chequeDate', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Issuing Bank</label>
                <input type="text" className={inputCls} placeholder="e.g. HBL, MCB, UBL" value={formState.chequeBank} onChange={(e) => handleField('chequeBank', e.target.value)} />
              </div>
            </>
          )}

          {selectedType === 'PAY_ORDER' && (
            <>
              <div>
                <label className={labelCls}>Payee Name</label>
                <input type="text" className={inputCls} placeholder="Full name on pay order" value={formState.payeeName} onChange={(e) => handleField('payeeName', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Payee CNIC</label>
                <input type="text" className={inputCls} placeholder="XXXXX-XXXXXXX-X" value={formState.payeeCnic} onChange={(e) => handleField('payeeCnic', e.target.value)} />
              </div>
            </>
          )}

          {selectedType === 'BILL_PAYMENT' && (
            <>
              <div>
                <label className={labelCls}>Bill Type</label>
                <select className={inputCls} value={formState.billType} onChange={(e) => handleField('billType', e.target.value)}>
                  <option value="">Select bill type</option>
                  <option value="ELECTRICITY">Electricity</option>
                  <option value="GAS">Gas</option>
                  <option value="WATER">Water</option>
                  <option value="TELEPHONE">Telephone</option>
                  <option value="INTERNET">Internet</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Consumer Number</label>
                <input type="text" className={inputCls} placeholder="Reference / Consumer No." value={formState.consumerNumber} onChange={(e) => handleField('consumerNumber', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Biller Name</label>
                <input type="text" className={inputCls} placeholder="e.g. KESC, SNGPL" value={formState.billerName} onChange={(e) => handleField('billerName', e.target.value)} />
              </div>
            </>
          )}

          {selectedType === 'FUND_TRANSFER' && (
            <>
              <div>
                <label className={labelCls}>Beneficiary Name</label>
                <input type="text" className={inputCls} placeholder="Full legal name" value={formState.beneficiaryName} onChange={(e) => handleField('beneficiaryName', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Beneficiary Account / IBAN</label>
                <input type="text" className={inputCls} placeholder="PK00XXXX0000000000000000" value={formState.beneficiaryAccount} onChange={(e) => handleField('beneficiaryAccount', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Beneficiary Bank</label>
                <input type="text" className={inputCls} placeholder="e.g. HBL, Meezan, UBL" value={formState.beneficiaryBank} onChange={(e) => handleField('beneficiaryBank', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Transfer Type</label>
                <select className={inputCls} value={formState.transferType} onChange={(e) => handleField('transferType', e.target.value)}>
                  <option value="IBFT">IBFT (Interbank)</option>
                  <option value="RTGS">RTGS (Same Day)</option>
                  <option value="NEFT">NEFT (Next Day)</option>
                </select>
              </div>
            </>
          )}

          {/* Spacer for scroll breathing room */}
          <div className="h-2" />
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={() => {
              if (!formState.accountNumber || !formState.amount) {
                setSubmitError('Account number and amount are required.');
                return;
              }
              setSubmitError(null);
              navigate('review');
            }}
            className="w-full bg-[#006B3F] text-white py-4 rounded-2xl font-bold text-base shadow-lg active:scale-95 transition-transform"
          >
            Review
          </button>
          {submitError && (
            <p className="text-red-500 text-xs text-center mt-2">{submitError}</p>
          )}
        </div>
      </div>
    );
  };

  const renderReview = () => {
    const rows: { label: string; value: string }[] = [
      { label: 'Transaction Type', value: selectedTypeInfo.label },
      { label: 'Account Number', value: formState.accountNumber || '—' },
      { label: 'Amount', value: `PKR ${parseFloat(formState.amount || '0').toLocaleString('en-PK')}` },
      { label: 'Narration', value: formState.narration || '—' },
      { label: 'Depositor', value: formState.depositorRelationship },
      { label: 'Channel', value: 'Mobile App' },
    ];

    if (selectedType === 'CHEQUE_DEPOSIT' && formState.chequeNumber) {
      rows.push({ label: 'Cheque No.', value: formState.chequeNumber });
    }
    if (selectedType === 'BILL_PAYMENT' && formState.consumerNumber) {
      rows.push({ label: 'Consumer No.', value: formState.consumerNumber });
    }
    if (selectedType === 'FUND_TRANSFER' && formState.beneficiaryName) {
      rows.push({ label: 'Beneficiary', value: formState.beneficiaryName });
    }

    return (
      <div className="flex flex-col h-full">
        <div className="relative bg-[#006B3F] px-5 pt-10 pb-6 overflow-hidden">
          <IslamicPattern />
          <div className="relative z-10 flex items-center gap-3">
            <button onClick={() => navigate('form')} className="text-white/80 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <div>
              <p className="text-white font-bold text-lg">Review Details</p>
              <p className="text-white/60 text-xs">Confirm before submitting</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden px-4 py-4">
          {/* Summary card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
            {rows.map((row, i) => (
              <div key={i} className={`flex justify-between items-center px-4 py-3 ${i < rows.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <span className="text-xs text-gray-400 font-medium">{row.label}</span>
                <span className="text-sm text-gray-800 font-semibold text-right max-w-[55%] break-all">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Gold info note */}
          <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-xl p-3 flex gap-2">
            <span className="text-[#C9A84C] text-lg flex-shrink-0">ℹ️</span>
            <p className="text-xs text-[#8a6d1a] leading-relaxed">
              A Digital Reference ID (DRID) will be generated. Present this to the teller at any Bank Islami branch within the validity period.
            </p>
          </div>

          {submitError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-xs">{submitError}</p>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-[#006B3F] text-white py-4 rounded-2xl font-bold text-base shadow-lg active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Generating DRID...
              </>
            ) : (
              'Confirm & Submit'
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderSuccess = () => {
    if (!successData) return null;
    const timerRed = secondsLeft < 300;

    return (
      <div className="flex flex-col h-full">
        <div className="relative bg-[#006B3F] px-5 pt-10 pb-8 overflow-hidden">
          <IslamicPattern />
          <div className="relative z-10 text-center">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-white font-bold text-xl">Slip Created!</p>
            <p className="text-white/60 text-xs mt-1">Show this to your teller</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden px-4 py-4 flex flex-col items-center">
          {/* DRID hero */}
          <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Your Reference ID</p>
            <p className="text-2xl font-bold text-[#006B3F] tracking-widest font-mono">{successData.drid}</p>
          </div>

          {/* QR code */}
          <div className="mb-4">
            <QrDisplay qrData={successData.qr_code_data} drid={successData.drid} />
          </div>

          {/* Countdown */}
          <div className={`w-full rounded-2xl p-4 text-center mb-4 ${timerRed ? 'bg-red-50 border border-red-200' : 'bg-[#C9A84C]/10 border border-[#C9A84C]/30'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${timerRed ? 'text-red-500' : 'text-[#C9A84C]'}`}>
              Valid For
            </p>
            <p className={`text-3xl font-bold font-mono mt-1 ${timerRed ? 'text-red-600' : 'text-[#8a6d1a]'}`}>
              {formatTime(secondsLeft)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Expires in {successData.validity_minutes} minutes from creation
            </p>
          </div>

          {/* Instructions */}
          <div className="w-full bg-[#006B3F]/5 border border-[#006B3F]/20 rounded-xl p-3 mb-4">
            <p className="text-xs text-[#006B3F] font-semibold mb-1">Next Steps</p>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>Visit any Bank Islami branch</li>
              <li>Show DRID or QR code to teller</li>
              <li>Teller will complete your transaction</li>
              <li>You'll receive an SMS confirmation</li>
            </ol>
          </div>
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={() => {
              setSuccessData(null);
              setFormState(defaultForm);
              setSelectedType('CASH_DEPOSIT');
              navigate('home');
            }}
            className="w-full border-2 border-[#006B3F] text-[#006B3F] py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  };

  const screenMap: Record<Screen, () => React.ReactNode> = {
    home: renderHome,
    'select-type': renderSelectType,
    form: renderForm,
    review: renderReview,
    success: renderSuccess,
  };

  // ── Bottom nav ────────────────────────────────────────────────────────────
  const bottomNav = [
    { icon: '🏠', label: 'Home', active: currentScreen === 'home' },
    { icon: '🏦', label: 'Accounts', active: false },
    { icon: '↔️', label: 'Transfer', active: false },
    { icon: '👤', label: 'Profile', active: false },
  ];

  // ── Shared bottom nav bar ─────────────────────────────────────────────────
  const renderBottomNav = () => (
    <div className="flex-shrink-0 border-t border-gray-100 bg-white px-2 py-1">
      <div className="flex justify-around">
        {bottomNav.map((item) => (
          <button key={item.label} className="flex flex-col items-center gap-0.5 py-1.5 px-3">
            <span className="text-lg leading-none">{item.icon}</span>
            <span className={`text-[9px] font-medium ${item.active ? 'text-[#006B3F]' : 'text-gray-400'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
      <div className="flex justify-center mt-0.5 pb-1">
        <div className="w-28 h-1 bg-black/20 rounded-full" />
      </div>
    </div>
  );

  // ── Root layout ───────────────────────────────────────────────────────────
  return (
    <>
      {/* ═══ MOBILE VIEW — full screen, no bezel ════════════════════════════
          Shown on real phones/tablets (< md = < 768px).
          The page fills the viewport like a native app.                    */}
      <div
        className="md:hidden fixed inset-0 flex flex-col bg-white overflow-hidden"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div key={screenKey} className="flex-1 overflow-hidden flex flex-col animate-fade-in min-h-0">
          {screenMap[currentScreen]?.()}
        </div>
        {renderBottomNav()}
      </div>

      {/* ═══ DESKTOP VIEW — phone mockup on dark background ═════════════════
          Shown on laptops/large screens (≥ md = ≥ 768px).
          Looks like a phone sitting on a desk for CIO demo.               */}
      <div className="hidden md:flex min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden>
          <p
            className="text-white/5 font-bold text-center leading-tight rotate-[-15deg] whitespace-nowrap"
            style={{ fontSize: 'clamp(2rem, 5vw, 5rem)' }}
          >
            Bank Islami<br />Digital Banking
          </p>
        </div>

        {/* Title above phone */}
        <div className="text-center mb-8 relative z-10">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">CIO Demo — Customer Flow</p>
          <h1 className="text-white font-bold text-2xl">Bank Islami Mobile</h1>
          <p className="text-white/50 text-sm mt-1">Digital Deposit Slip Experience</p>
        </div>

        {/* Phone bezel */}
        <div className="relative z-10">
          <div
            className="relative bg-[#1C1C1E] rounded-[55px] p-[14px]"
            style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)' }}
          >
            {/* Side buttons — decorative */}
            <div className="absolute -left-[3px] top-[130px] w-[3px] h-[40px] bg-[#3A3A3C] rounded-l-sm" />
            <div className="absolute -left-[3px] top-[185px] w-[3px] h-[40px] bg-[#3A3A3C] rounded-l-sm" />
            <div className="absolute -right-[3px] top-[155px] w-[3px] h-[70px] bg-[#3A3A3C] rounded-r-sm" />

            {/* Screen area */}
            <div
              className="bg-white overflow-hidden flex flex-col"
              style={{ width: '362px', height: '752px', borderRadius: '44px' }}
            >
              {/* Dynamic island */}
              <div className="relative flex-shrink-0 h-[50px] bg-gray-50">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[34px] bg-black rounded-b-[20px] z-10" />
              </div>

              {/* Status bar */}
              <div className="flex-shrink-0 flex items-center justify-between px-6 -mt-[4px] mb-0 text-gray-800">
                <span className="text-xs font-semibold">{currentTime || '09:41'}</span>
                <div className="flex items-center gap-1.5">
                  <SignalBars />
                  <BatteryIcon />
                </div>
              </div>

              {/* Screen content */}
              <div key={screenKey} className="flex-1 overflow-hidden flex flex-col animate-fade-in">
                {screenMap[currentScreen]?.()}
              </div>

              {renderBottomNav()}
            </div>
          </div>
        </div>

        {/* Help text */}
        <div className="text-center mt-8 relative z-10 text-white/30 text-xs max-w-sm">
          <p>Navigate through the flow → get DRID → go to Dashboard → DRID Lookup to complete as teller</p>
        </div>
      </div>
    </>
  );
};

export default MobileDemo;
